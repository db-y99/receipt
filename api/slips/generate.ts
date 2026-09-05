import type { VercelRequest, VercelResponse } from '@vercel/node';
import JSZip from 'jszip';
import { drawStandardSlipPdf } from '../lib/drawStandardPdf';
import {
  buildPdfBaseName,
  fetchLoanByCode,
  mapLoanToStandardSlip,
  uniquePdfFileName,
} from '../lib/slipMap';
import type { SlipCustomerData } from '../lib/slipCompany';

export const config = {
  maxDuration: 60,
};

const MAX_CODES = 20;

function getApiKey(req: VercelRequest): string {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string') return header.trim();
  if (Array.isArray(header) && header[0]) return header[0].trim();
  return '';
}

function parseLoanCodes(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const record = body as Record<string, unknown>;
  const raw = record.loanCodes;
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw.map((c) => String(c || '').trim()).filter(Boolean);
  } else if (typeof raw === 'string') {
    list = raw
      .split(/[\s,;]+/)
      .map((c) => c.trim())
      .filter(Boolean);
  }
  return [...new Set(list)].slice(0, MAX_CODES);
}

function parseCustomerData(body: unknown): SlipCustomerData | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const data = record.customerData;
  if (!data || typeof data !== 'object') return null;
  const c = data as Record<string, unknown>;
  return {
    type: 'STANDARD',
    fullName: String(c.fullName || ''),
    customerId: String(c.customerId || ''),
    contractId: String(c.contractId || ''),
    transferContent: String(c.transferContent || ''),
    address: String(c.address || ''),
    amount: Number(c.amount) || 0,
    deadline: String(c.deadline || new Date().toISOString().split('T')[0]),
    principal: Number(c.principal) || 0,
    interest: Number(c.interest) || 0,
    managementFee: Number(c.managementFee) || 0,
  };
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedKey = process.env.SLIP_API_KEY || '';
  if (!expectedKey || getApiKey(req) !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiBaseUrl = process.env.API_BASE_URL || '';
  const apiLogin = process.env.API_LOGIN || '';
  if (!apiBaseUrl) {
    return res.status(503).json({ error: 'Chưa cấu hình API_BASE_URL' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const direct = parseCustomerData(body);
    const codes = parseLoanCodes(body);

    if (!direct && codes.length === 0) {
      return res.status(400).json({
        error: 'Cần loanCodes (mảng mã AP/LN) hoặc customerData',
      });
    }

    const slips: { fileName: string; pdf: Buffer }[] = [];
    const missingCodes: string[] = [];
    const usedNames = new Set<string>();

    if (direct) {
      const pdf = await drawStandardSlipPdf(direct);
      slips.push({
        fileName: uniquePdfFileName(buildPdfBaseName(direct), usedNames),
        pdf,
      });
    } else {
      for (const code of codes) {
        const loan = await fetchLoanByCode(apiBaseUrl, code, apiLogin);
        if (!loan) {
          missingCodes.push(code);
          continue;
        }
        const slip = mapLoanToStandardSlip(loan);
        const pdf = await drawStandardSlipPdf(slip);
        const base =
          codes.length > 1 && slip.contractId
            ? `${buildPdfBaseName(slip)} - ${slip.contractId}`
            : buildPdfBaseName(slip);
        slips.push({
          fileName: uniquePdfFileName(base, usedNames),
          pdf,
        });
      }
    }

    if (slips.length === 0) {
      return res.status(404).json({
        error: 'Không tìm thấy khoản vay nào để tạo phiếu',
        missingCodes,
      });
    }

    if (missingCodes.length > 0) {
      res.setHeader('X-Missing-Codes', missingCodes.join(','));
    }
    res.setHeader('X-Generated-Count', String(slips.length));

    if (slips.length === 1) {
      const file = slips[0];
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', contentDisposition(file.fileName));
      return res.status(200).send(file.pdf);
    }

    const zip = new JSZip();
    for (const file of slips) {
      zip.file(file.fileName, file.pdf);
    }
    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
    const zipName = `Phieu-thu-${slips.length}-files.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', contentDisposition(zipName));
    return res.status(200).send(zipBuf);
  } catch (err) {
    console.error('[api/slips/generate]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Tạo phiếu thất bại',
    });
  }
}
