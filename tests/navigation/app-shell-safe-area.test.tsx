/**
 * AppShell must keep its header and tab bar clear of the system bars
 * (Android draws edge-to-edge; RN's own SafeAreaView is iOS-only).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 48, left: 0, right: 0 }),
}));
// Native camera / validation screens are not under test here.
jest.mock('../../src/screens/screening/ActiveScreeningScreen', () => () => null);
jest.mock('../../src/validation/DV1AValidationScreen', () => () => null);

import { ScreeningProvider } from '../../src/context/ScreeningContext';
import AppShell from '../../src/navigation/AppShell';
import { screeningRepository } from '../../src/storage/screening-repository';

beforeEach(() => {
  jest.spyOn(screeningRepository, 'getSessions').mockResolvedValue([]);
});
afterEach(() => jest.restoreAllMocks());

function renderShell() {
  return render(
    <ScreeningProvider>
      <AppShell />
    </ScreeningProvider>,
  );
}

test('content starts below the status bar', async () => {
  const view = await renderShell();
  expect(StyleSheet.flatten(view.getByTestId('app-shell').props.style).paddingTop).toBe(40);
  // With a tab bar, the tab bar (not the screen body) absorbs the bottom inset.
  expect(StyleSheet.flatten(view.getByTestId('screen-body').props.style).paddingBottom).toBeUndefined();
});

test('tab bar sits above the system navigation bar', async () => {
  const view = await renderShell();
  // 16 px design padding + 48 px navigation bar inset
  expect(StyleSheet.flatten(view.getByTestId('tab-bar').props.style).paddingBottom).toBe(64);
});

test('screens without a tab bar still keep clear of the navigation bar', async () => {
  const view = await renderShell();
  await fireEvent.press(view.getByText('⚙ DV-1A'));
  expect(view.queryByTestId('tab-bar')).toBeNull();
  expect(StyleSheet.flatten(view.getByTestId('screen-body').props.style).paddingBottom).toBe(48);
});
