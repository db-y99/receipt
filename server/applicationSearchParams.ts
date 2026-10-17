export const APPLICATION_FIELDS = [
  'id',
  'fullname',
  'customer__code',
  'code',
  'phone',
  'address',
] as const;

export const APPLICATION_SEARCH_LIMIT = 15;

const DEFAULT_FILTER = {
  create_time__date__gte: '1927-12-03',
  status: 7,
};

export function buildApplicationSearchParams(query: string, login?: string): URLSearchParams {
  const params = new URLSearchParams({
    sort: '-id',
    limit: String(APPLICATION_SEARCH_LIMIT),
    values: APPLICATION_FIELDS.join(','),
    filter: JSON.stringify(DEFAULT_FILTER),
    filter_or: JSON.stringify({
      fullname__icontains: query,
      code__icontains: query,
    }),
  });

  if (login) {
    params.set('login', login);
  }

  return params;
}

export function buildApplicationSearchUrl(apiBaseUrl: string, query: string, login?: string): string {
  const params = buildApplicationSearchParams(query, login);
  return `${apiBaseUrl.replace(/\/$/, '')}/data/Application/?${params.toString()}`;
}
