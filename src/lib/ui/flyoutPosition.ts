import { useState, useEffect, useLayoutEffect } from 'react';
import type React from 'react';
import type { PanelPosition, PanelStyle } from '../../types/desktop';

export interface FlyoutPositionOptions {
  anchorRef?: React.RefObject<HTMLElement | null>;
  anchorEl?: HTMLElement | null;
  panelPosition?: PanelPosition;
  panelStyle?: PanelStyle;
  preferredWidth?: number;
  preferredHeight?: number;
  align?: 'start' | 'center' | 'end';
  offset?: number;
}

export interface FlyoutPlacement {
  style: React.CSSProperties;
  positionClass: 'position-top' | 'position-bottom' | 'position-left' | 'position-right';
  direction: 'up' | 'down' | 'left' | 'right';
}

export function computeFlyoutPlacement(options: FlyoutPositionOptions): FlyoutPlacement {
  const {
    anchorRef,
    anchorEl = anchorRef?.current,
    panelPosition = 'top',
    preferredWidth = 360,
    preferredHeight = 460,
    align = 'start',
    offset = 8,
  } = options;

  const vpWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vpHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const margin = 12;

  const rect = anchorEl?.getBoundingClientRect();

  // BOTTOM DOCK -> flyout opens UPWARD
  if (panelPosition === 'bottom') {
    const bottom = rect ? Math.round(vpHeight - rect.top + offset) : 56;
    const maxHeight = Math.max(220, Math.min(preferredHeight, (rect ? rect.top : vpHeight - 56) - 16));
    const width = Math.min(preferredWidth, vpWidth - margin * 2);

    let leftVal: number | undefined;
    let rightVal: number | undefined;

    if (align === 'start') {
      const rawLeft = rect ? rect.left : margin;
      leftVal = Math.max(margin, Math.min(rawLeft, vpWidth - width - margin));
    } else if (align === 'end') {
      const rawRight = rect ? vpWidth - rect.right : margin;
      rightVal = Math.max(margin, Math.min(rawRight, vpWidth - width - margin));
    } else {
      const rawCenter = rect ? rect.left + rect.width / 2 - width / 2 : vpWidth / 2 - width / 2;
      leftVal = Math.max(margin, Math.min(rawCenter, vpWidth - width - margin));
    }

    const style: React.CSSProperties = {
      position: 'fixed',
      bottom: `${bottom}px`,
      maxHeight: `${maxHeight}px`,
      width: `${width}px`,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
    };
    if (leftVal !== undefined) style.left = `${leftVal}px`;
    if (rightVal !== undefined) style.right = `${rightVal}px`;

    return {
      style,
      positionClass: 'position-bottom',
      direction: 'up',
    };
  }

  // TOP DOCK -> flyout opens DOWNWARD
  if (panelPosition === 'top') {
    const top = rect ? Math.round(rect.bottom + offset) : 56;
    const maxHeight = Math.max(220, Math.min(preferredHeight, vpHeight - top - 16));
    const width = Math.min(preferredWidth, vpWidth - margin * 2);

    let leftVal: number | undefined;
    let rightVal: number | undefined;

    if (align === 'start') {
      const rawLeft = rect ? rect.left : margin;
      leftVal = Math.max(margin, Math.min(rawLeft, vpWidth - width - margin));
    } else if (align === 'end') {
      const rawRight = rect ? vpWidth - rect.right : margin;
      rightVal = Math.max(margin, Math.min(rawRight, vpWidth - width - margin));
    } else {
      const rawCenter = rect ? rect.left + rect.width / 2 - width / 2 : vpWidth / 2 - width / 2;
      leftVal = Math.max(margin, Math.min(rawCenter, vpWidth - width - margin));
    }

    const style: React.CSSProperties = {
      position: 'fixed',
      top: `${top}px`,
      maxHeight: `${maxHeight}px`,
      width: `${width}px`,
      maxWidth: `calc(100vw - ${margin * 2}px)`,
    };
    if (leftVal !== undefined) style.left = `${leftVal}px`;
    if (rightVal !== undefined) style.right = `${rightVal}px`;

    return {
      style,
      positionClass: 'position-top',
      direction: 'down',
    };
  }

  // LEFT DOCK -> flyout opens RIGHT
  if (panelPosition === 'left') {
    const left = rect ? Math.round(rect.right + offset) : 56;
    const maxWidth = Math.max(240, Math.min(preferredWidth, vpWidth - left - margin));
    const height = Math.min(preferredHeight, vpHeight - margin * 2);

    let topVal: number | undefined;
    let bottomVal: number | undefined;

    if (align === 'start') {
      const rawTop = rect ? rect.top : margin;
      topVal = Math.max(margin, Math.min(rawTop, vpHeight - height - margin));
    } else if (align === 'end') {
      const rawBottom = rect ? vpHeight - rect.bottom : margin;
      bottomVal = Math.max(margin, Math.min(rawBottom, vpHeight - height - margin));
    } else {
      const rawCenter = rect ? rect.top + rect.height / 2 - height / 2 : vpHeight / 2 - height / 2;
      topVal = Math.max(margin, Math.min(rawCenter, vpHeight - height - margin));
    }

    const style: React.CSSProperties = {
      position: 'fixed',
      left: `${left}px`,
      width: `${preferredWidth}px`,
      maxWidth: `${maxWidth}px`,
      maxHeight: `${height}px`,
    };
    if (topVal !== undefined) style.top = `${topVal}px`;
    if (bottomVal !== undefined) style.bottom = `${bottomVal}px`;

    return {
      style,
      positionClass: 'position-left',
      direction: 'right',
    };
  }

  // RIGHT DOCK -> flyout opens LEFT
  const right = rect ? Math.round(vpWidth - rect.left + offset) : 56;
  const maxWidth = Math.max(240, Math.min(preferredWidth, (rect ? rect.left : vpWidth - 56) - margin));
  const height = Math.min(preferredHeight, vpHeight - margin * 2);

  let topVal: number | undefined;
  let bottomVal: number | undefined;

  if (align === 'start') {
    const rawTop = rect ? rect.top : margin;
    topVal = Math.max(margin, Math.min(rawTop, vpHeight - height - margin));
  } else if (align === 'end') {
    const rawBottom = rect ? vpHeight - rect.bottom : margin;
    bottomVal = Math.max(margin, Math.min(rawBottom, vpHeight - height - margin));
  } else {
    const rawCenter = rect ? rect.top + rect.height / 2 - height / 2 : vpHeight / 2 - height / 2;
    topVal = Math.max(margin, Math.min(rawCenter, vpHeight - height - margin));
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    right: `${right}px`,
    width: `${preferredWidth}px`,
    maxWidth: `${maxWidth}px`,
    maxHeight: `${height}px`,
  };
  if (topVal !== undefined) style.top = `${topVal}px`;
  if (bottomVal !== undefined) style.bottom = `${bottomVal}px`;

  return {
    style,
    positionClass: 'position-right',
    direction: 'left',
  };
}

export function useFlyoutPlacement(options: FlyoutPositionOptions): FlyoutPlacement {
  const [placement, setPlacement] = useState<FlyoutPlacement>(() =>
    computeFlyoutPlacement(options)
  );

  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    const update = () => {
      setPlacement(computeFlyoutPlacement(options));
    };

    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true });

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [
    options.anchorEl,
    options.anchorRef?.current,
    options.panelPosition,
    options.panelStyle,
    options.preferredWidth,
    options.preferredHeight,
    options.align,
    options.offset,
  ]);

  return placement;
}
