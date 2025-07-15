import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileService } from '@/lib/services/file-service';

describe('FileService.writeLangFile with format support', () => {
  let mockInvoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockInvoke = vi.fn();
    FileService.setTestInvokeOverride(mockInvoke);
  });

  it('should write lang file with JSON format by default', async () => {
    mockInvoke.mockResolvedValue(true);

    const result = await FileService.writeLangFile(
      'testmod',
      'ja_jp',
      { 'item.test': 'テストアイテム' },
      '/path/to/resourcepack'
    );

    expect(result).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('write_lang_file', {
      modId: 'testmod',
      language: 'ja_jp',
      content: JSON.stringify({ 'item.test': 'テストアイテム' }),
      dir: '/path/to/resourcepack',
      format: 'json'
    });
  });

  it('should write lang file with JSON format when specified', async () => {
    mockInvoke.mockResolvedValue(true);

    const result = await FileService.writeLangFile(
      'testmod',
      'ja_jp',
      { 'item.test': 'テストアイテム' },
      '/path/to/resourcepack',
      'json'
    );

    expect(result).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('write_lang_file', {
      modId: 'testmod',
      language: 'ja_jp',
      content: JSON.stringify({ 'item.test': 'テストアイテム' }),
      dir: '/path/to/resourcepack',
      format: 'json'
    });
  });

  it('should write lang file with lang format when specified', async () => {
    mockInvoke.mockResolvedValue(true);

    const result = await FileService.writeLangFile(
      'testmod',
      'ja_jp',
      { 'item.test': 'テストアイテム', 'block.test': 'テストブロック' },
      '/path/to/resourcepack',
      'lang'
    );

    expect(result).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('write_lang_file', {
      modId: 'testmod',
      language: 'ja_jp',
      content: JSON.stringify({ 'item.test': 'テストアイテム', 'block.test': 'テストブロック' }),
      dir: '/path/to/resourcepack',
      format: 'lang'
    });
  });

  it('should handle errors when writing lang file', async () => {
    mockInvoke.mockRejectedValue(new Error('Write failed'));

    await expect(
      FileService.writeLangFile(
        'testmod',
        'ja_jp',
        { 'item.test': 'テストアイテム' },
        '/path/to/resourcepack',
        'lang'
      )
    ).rejects.toThrow('Write failed');
  });
});