import { apiJson } from '../../utils/api';
import { createWidget } from '../createWidget';
import { deleteWidget } from '../deleteWidget';

jest.mock('../../utils/api', () => ({
  apiJson: jest.fn(),
}));

const mockApiJson = apiJson as jest.MockedFunction<typeof apiJson>;

describe('dashboard widget mutations', () => {
  beforeEach(() => {
    mockApiJson.mockReset();
  });

  it('creates report widgets through the canonical endpoint with reportId', async () => {
    const widget = {
      id: '42',
      type: 'report',
      title: 'Tore',
      name: 'Tore',
      width: 6,
      position: 2,
      reportId: 17,
      enabled: true,
      default: false,
    };
    mockApiJson.mockResolvedValue({ widget });

    await expect(createWidget({ type: 'report', reportId: 17 })).resolves.toEqual(widget);
    expect(mockApiJson).toHaveBeenCalledWith('/api/widget', {
      method: 'POST',
      body: { type: 'report', reportId: 17 },
    });
  });

  it('deletes widgets through the same canonical resource', async () => {
    mockApiJson.mockResolvedValue({ status: 'success' });

    await deleteWidget('42');

    expect(mockApiJson).toHaveBeenCalledWith('/api/widget/42', { method: 'DELETE' });
  });
});
