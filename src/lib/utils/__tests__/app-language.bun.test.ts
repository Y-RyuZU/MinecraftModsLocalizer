import { expect, test } from 'bun:test';
import { resolveAppLanguage } from '../app-language';

test('app language follows the first supported OS preference, including regional variants', () => {
  expect(resolveAppLanguage(['ja-JP', 'en'])).toBe('ja');
  expect(resolveAppLanguage(['nl-NL', 'de-CH', 'en'])).toBe('de');
  expect(resolveAppLanguage(['zh-Hans-CN'])).toBe('zh-CN');
  expect(resolveAppLanguage(['pt_PT'])).toBe('pt-BR');
  expect(resolveAppLanguage('fr-CA')).toBe('fr');
  expect(resolveAppLanguage(['nl-NL'])).toBe('en');
  expect(resolveAppLanguage([])).toBe('en');
  expect(resolveAppLanguage(undefined)).toBe('en');
});
