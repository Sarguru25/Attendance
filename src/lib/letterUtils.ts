import { format } from 'date-fns';

export function renderLetterContentHTML(
  templateContent: string,
  employee: any,
  variables: Record<string, any> = {},
  createdAt?: Date | string
): string {
  if (!templateContent) return '';
  let html = templateContent;

  const letterDate = createdAt
    ? format(new Date(createdAt), 'dd/MM/yyyy')
    : format(new Date(), 'dd/MM/yyyy');

  const standardPlaceholders: Record<string, string> = {
    '{{employeeName}}': employee?.name || '',
    '{{employeeCode}}': employee?.employeeId || '',
    '{{designation}}': employee?.designation || '',
    '{{department}}': employee?.department || '',
    '{{email}}': employee?.email || '',
    '{{currentDate}}': letterDate,
    '{{companyName}}': employee?.companyId?.companyName || 'TruFlow Solutions',
  };

  Object.keys(standardPlaceholders).forEach((key) => {
    html = html.replace(new RegExp(key, 'g'), standardPlaceholders[key] || '');
  });

  if (variables) {
    Object.keys(variables).forEach((varName) => {
      const regex = new RegExp(`{{${varName}}}`, 'g');
      const val = variables[varName];
      html = html.replace(regex, val !== undefined && val !== null ? String(val) : `[${varName}]`);
    });
  }

  return html;
}
