import { apiJson } from '../utils/api';
import { WidgetData } from './dashboardWidgets';

export async function createWidget({ type, reportId }: { type: string; reportId?: number }): Promise<WidgetData> {
  const res = await apiJson('/api/widget/add', {
    method: 'POST',
    body: {
      type,
      ...(reportId ? { reportId } : {})
    }
  });
  return res.widget;
}
