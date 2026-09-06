/* eslint-disable @typescript-eslint/no-require-imports -- fabriques jest.mock hissées */
import { act, render, screen } from "@testing-library/react-native";

const mockFocus = { value: true, listeners: new Set<() => void>() };
jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      const focused = React.useSyncExternalStore(
        (l: () => void) => {
          mockFocus.listeners.add(l);
          return () => mockFocus.listeners.delete(l);
        },
        () => mockFocus.value,
      );
      React.useEffect(() => (focused ? callback() : undefined), [callback, focused]);
    },
  };
});
jest.mock("expo-status-bar", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { StatusBar: ({ style }: { style: string }) => React.createElement(View, { testID: `status-bar-${style}` }) };
});

// eslint-disable-next-line import/first
import { FocusedStatusBar } from "../FocusedStatusBar";

const setFocus = (value: boolean) =>
  act(() => {
    mockFocus.value = value;
    mockFocus.listeners.forEach((l) => l());
  });

beforeEach(() => {
  mockFocus.value = true;
});

describe("FocusedStatusBar", () => {
  it("pose le style demandé quand l'écran a le focus", async () => {
    await render(<FocusedStatusBar style="light" />);
    expect(screen.getByTestId("status-bar-light")).toBeTruthy();
  });

  it("ne pose RIEN quand l'écran n'a pas le focus (les onglets restent montés)", async () => {
    await render(<FocusedStatusBar style="light" />);
    await setFocus(false);
    expect(screen.queryByTestId("status-bar-light")).toBeNull();
    await setFocus(true);
    expect(screen.getByTestId("status-bar-light")).toBeTruthy();
  });
});
