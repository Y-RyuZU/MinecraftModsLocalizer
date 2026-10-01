import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RetranslationControl } from '@/components/tabs/common/retranslation-control';
import type { TranslationTarget } from '@/lib/types/minecraft';

vi.mock('@/lib/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));

describe('shared retranslation control', () => {
  it.each([false, true])('uses the same selection behavior for async=%s detection', async asynchronous => {
    const target: TranslationTarget = { id: 'one', name: 'one', path: '/one', type: 'ftb', selected: true };
    const updateTarget = vi.fn();
    const hasExistingTranslation = (_target: TranslationTarget, language: string) => asynchronous ? Promise.resolve(language === 'ja_jp') : language === 'ja_jp';
    const props = { target, targetLanguage: 'ja-JP', updateTarget, disabled: false, hasExistingTranslation };
    const { rerender } = render(<RetranslationControl {...props} />);
    await userEvent.click(await screen.findByRole('checkbox'));
    expect(updateTarget).toHaveBeenCalledWith({ forceTranslationLanguage: 'ja_jp' });
    rerender(<RetranslationControl {...props} target={{ ...target, forceTranslationLanguage: 'ja_jp' }} />);
    expect(await screen.findByRole('checkbox')).toBeChecked();
    expect(screen.queryByText('tables.existingTranslationSkipped')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(updateTarget).toHaveBeenLastCalledWith({ forceTranslationLanguage: undefined });
    rerender(<RetranslationControl {...props} targetLanguage="ko_kr" />);
    await waitFor(() => expect(screen.queryByRole('checkbox')).not.toBeInTheDocument());
  });
});
