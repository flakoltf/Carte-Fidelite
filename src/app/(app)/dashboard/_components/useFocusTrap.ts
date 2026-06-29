"use client";

import { useEffect, useRef } from "react";

// Piège de focus partagé pour les boîtes de dialogue modales (EditCustomerModal,
// AmountPad, RedeemFullScreen). UNE primitive, pas trois implémentations.
// Quand `active` :
//   • autofocus à l'ouverture (1er focusable, sinon le conteneur) ;
//   • Tab / Shift+Tab bouclent à l'intérieur du dialog ;
//   • Échap appelle `onClose` ;
//   • restitue le focus à l'élément déclencheur à la fermeture.
// Pose la ref retournée sur le conteneur du dialog (qui doit avoir tabIndex={-1}).
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onClose?: () => void,
) {
  const ref = useRef<T>(null);
  // onClose capturé par ref : évite de relancer l'effet (et de re-déclencher
  // l'autofocus) à chaque rendu si le parent recrée la fonction.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Autofocus : élément marqué [data-autofocus] s'il existe (ex. 1er champ
    // plutôt que le bouton de fermeture), sinon 1er focusable, sinon conteneur.
    const preferred = node.querySelector<HTMLElement>("[data-autofocus]");
    (preferred ?? focusables()[0] ?? node).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !node.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !node.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      // Restitue le focus au déclencheur (s'il existe encore dans le DOM).
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return ref;
}
