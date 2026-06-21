import { apiJson } from '../utils/api';

/**
 * Löscht ein Widget anhand seiner ID im Backend.
 * @param widgetId Die ID des zu löschenden Widgets
 * @returns Promise<void>
 */
export async function deleteWidget(widgetId: string): Promise<void> {
  await apiJson(`/api/widget/${widgetId}`, {
    method: 'DELETE',
  });
}
