/* eslint-disable @typescript-eslint/no-require-imports -- fabriques jest.mock hissées */
import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

// Focus d'onglet pilotable depuis le test.
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

// eslint-disable-next-line import/first
import { useCameraActive } from "../useCameraActive";

const setFocus = (value: boolean) =>
  act(() => {
    mockFocus.value = value;
    mockFocus.listeners.forEach((l) => l());
  });

let appStateHandlers: ((s: AppStateStatus) => void)[] = [];
const emitAppState = (s: AppStateStatus) => act(() => appStateHandlers.forEach((h) => h(s)));

beforeEach(() => {
  mockFocus.value = true;
  appStateHandlers = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    appStateHandlers.push(handler as (s: AppStateStatus) => void);
    return { remove: jest.fn() };
  });
});

afterEach(() => jest.restoreAllMocks());

describe("useCameraActive", () => {
  it("active tant que l'onglet est visible et l'app au premier plan", async () => {
    const { result } = await renderHook(() => useCameraActive());
    expect(result.current).toBe(true);
  });

  it("s'éteint quand on change d'onglet, se rallume au retour", async () => {
    const { result } = await renderHook(() => useCameraActive());
    await setFocus(false);
    expect(result.current).toBe(false);
    await setFocus(true);
    expect(result.current).toBe(true);
  });

  it("s'éteint quand l'app passe en arrière-plan, se rallume quand elle revient", async () => {
    const { result } = await renderHook(() => useCameraActive());
    await emitAppState("background");
    expect(result.current).toBe(false);
    await emitAppState("active");
    expect(result.current).toBe(true);
  });

  it("se désabonne d'AppState au démontage", async () => {
    const remove = jest.fn();
    (AppState.addEventListener as jest.Mock).mockImplementation(() => ({ remove }));
    const { unmount } = await renderHook(() => useCameraActive());
    await act(() => unmount());
    expect(remove).toHaveBeenCalled();
  });
});
