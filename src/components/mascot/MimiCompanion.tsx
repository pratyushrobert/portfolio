import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Volume2,
  X,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useDesktopStore } from '../../stores/useDesktopStore';
import { useMascotStore, GUIDE_STEPS } from '../../stores/useMascotStore';
import { MimiPixelCat } from './MimiPixelCat';
import { playMimiMeow } from '../../lib/audio/mimiAudio';
import './MimiCompanion.css';

interface MimiCompanionProps {
  onOpenApp?: (appId: string) => void;
}

const CAT_QUOTES: Record<string, string> = {
  idle: 'Purring along smoothly. MimiOS is all yours to explore!',
  walking: 'Patrolling the desktop perimeter...',
  looking_around: 'Inspecting running processes and system resources.',
  greeting: 'Welcome to MimiOS! I’m Mimi, your cyber desktop companion.',
  talking: 'Did you know? You can pipe commands in Terminal just like UNIX!',
  thinking: 'Analyzing defensive firewall rules and encrypted payloads...',
  happy: 'All systems operating at peak performance. *purrr*',
  confused: 'Hmm? I couldn’t find that file in VirtualFS.',
  sleeping: 'Zzz... Low power standby mode engaged.',
};

export const MimiCompanion: React.FC<MimiCompanionProps> = ({ onOpenApp: _onOpenApp }) => {
  const mascotEnabled = useDesktopStore(state => state.mascotEnabled ?? true);
  const panelPosition = useDesktopStore(state => state.panelPosition ?? 'bottom');

  const {
    mood,
    facingDirection,
    isGuideActive,
    guideStepIndex,
    hasCompletedGuide,
    companionPosition,
    speechBubble,
    dismissMascot,
    speak,
    dismissSpeechBubble,
    navigateToApp,
    setCompanionPosition,
    startGuide,
    closeGuide,
    nextGuideStep,
    prevGuideStep,
    skipGuide,
    finishGuide,
  } = useMascotStore();

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startPosX: number; startPosY: number } | null>(null);
  const hasMovedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute default resting position: bottom-right above dock
  const getDefaultPosition = useCallback(() => {
    if (typeof window === 'undefined') return { x: 100, y: 100 };
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    let bottomOffset = 64;
    let rightOffset = 24;

    if (panelPosition === 'bottom') {
      bottomOffset = 64;
    } else if (panelPosition === 'right') {
      rightOffset = 64;
    }

    return {
      x: winWidth - rightOffset - 64,
      y: winHeight - bottomOffset - 64,
    };
  }, [panelPosition]);

  // Current coordinates
  const currentPos = companionPosition || getDefaultPosition();

  // Pointer drag handling
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    hasMovedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPosX: currentPos.x,
      startPosY: currentPos.y,
    };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (!hasMovedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      hasMovedRef.current = true;
      setIsDragging(true);
    }

    if (hasMovedRef.current) {
      const newX = Math.max(10, Math.min(window.innerWidth - 64, dragStartRef.current.startPosX + dx));
      const newY = Math.max(36, Math.min(window.innerHeight - 64, dragStartRef.current.startPosY + dy));
      setCompanionPosition({ x: newX, y: newY });
      if (containerRef.current) {
        containerRef.current.style.left = `${newX}px`;
        containerRef.current.style.top = `${newY}px`;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore pointer release errors
    }
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasMovedRef.current) return;
    if (isGuideActive) return;
    playMimiMeow({ force: false });

    const currentSpeech = useMascotStore.getState().speechBubble;
    if (currentSpeech) {
      dismissSpeechBubble();
    } else {
      const quote = CAT_QUOTES[mood] || CAT_QUOTES.idle;
      speak(quote, {
        durationMs: 4500,
        actionLabel: 'Take Tour',
        onAction: () => startGuide(),
      });
    }
  };

  // Launch app action helper with companion walk navigation
  const handleTriggerAction = async (appId?: string) => {
    if (!appId) return;
    await navigateToApp(appId);
  };

  const handlePlaySound = (e: React.MouseEvent) => {
    e.stopPropagation();
    playMimiMeow({ force: true });
  };

  // First-time visitor contextual greeting in tiny speech bubble
  useEffect(() => {
    if (!hasCompletedGuide && mascotEnabled) {
      const timer = setTimeout(() => {
        const state = useMascotStore.getState();
        if (!state.speechBubble && !state.isGuideActive) {
          speak('Mrrp! Want me to show you around?', {
            durationMs: 7000,
            actionLabel: 'Take Tour',
            onAction: () => startGuide(),
          });
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedGuide, mascotEnabled, speak, startGuide]);

  if (!mascotEnabled) {
    return null;
  }

  const currentStep = GUIDE_STEPS[guideStepIndex] || GUIDE_STEPS[0];
  const isLastStep = guideStepIndex === GUIDE_STEPS.length - 1;

  // Viewport bounds for speech bubble
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const isBubbleAbove = currentPos.y >= 110;
  const isBubbleLeft = currentPos.x < 140;
  const isBubbleRight = currentPos.x > winWidth - 220;

  const bubbleClass = `mimi-speech-bubble-floating ${
    isBubbleAbove ? 'pos-above' : 'pos-below'
  } ${isBubbleLeft ? 'align-left' : isBubbleRight ? 'align-right' : 'align-center'}`;

  return (
    <div
      ref={containerRef}
      className="mimi-companion-container"
      style={{
        left: currentPos.x,
        top: currentPos.y,
      }}
    >
      {/* ================= STATE B: ORDINARY CONTEXTUAL SPEECH BUBBLE ================= */}
      {speechBubble && !isGuideActive && (
        <div className={bubbleClass} role="status" aria-live="polite" onClick={e => e.stopPropagation()}>
          <div className="mimi-speech-content">
            <span className="mimi-speech-text">{speechBubble.text}</span>
            {speechBubble.actionLabel && speechBubble.onAction && (
              <button
                type="button"
                className="mimi-speech-action-btn"
                onClick={() => {
                  speechBubble.onAction?.();
                  dismissSpeechBubble();
                }}
              >
                <Sparkles size={11} /> {speechBubble.actionLabel}
              </button>
            )}
          </div>
          <button
            type="button"
            className="mimi-speech-close-btn"
            title="Dismiss speech"
            aria-label="Dismiss speech"
            onClick={e => {
              e.stopPropagation();
              dismissSpeechBubble();
            }}
          >
            <X size={11} />
          </button>
          <div className="mimi-speech-tail" />
        </div>
      )}

      {/* ================= STATE A: IDLE COMPANION (DRAGGABLE PIXEL CAT) ================= */}
      <div
        className="mimi-mascot-anchor"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        title="Mimi — OS Mascot (Click to chat, drag to reposition)"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="mimi-cat-sprite-wrapper"
          style={{
            transform: facingDirection === 'left' ? 'scaleX(-1)' : 'scaleX(1)',
            transition: 'transform 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MimiPixelCat mood={mood} size={52} />
        </div>

        {/* Dismiss control on anchor hover to hide mascot */}
        <button
          type="button"
          className="mimi-anchor-close-btn"
          title="Hide Mimi mascot"
          aria-label="Hide mascot"
          onClick={e => {
            e.stopPropagation();
            dismissMascot();
          }}
        >
          <X size={10} />
        </button>

        {/* Small greeting pill on hover or initial tour step */}
        <div className={`mimi-mascot-pill ${isGuideActive ? 'pill-visible' : ''}`}>
          {isGuideActive ? `Tour: Step ${guideStepIndex + 1}/7` : 'Mimi OS Cat'}
        </div>
      </div>

      {/* ================= STATE C: COMPACT INTERACTIVE TOUR PANEL ================= */}
      {isGuideActive && (
        <div
          className="mimi-tour-panel-compact"
          style={{
            right: currentPos.x > winWidth - 310 ? 0 : 'auto',
            left: currentPos.x > winWidth - 310 ? 'auto' : 0,
            bottom: currentPos.y < 340 ? 'auto' : 58,
            top: currentPos.y < 340 ? 58 : 'auto',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Tour Header */}
          <div className="mimi-tour-header">
            <div className="mimi-tour-header-info">
              <span className="mimi-tour-badge">Step {guideStepIndex + 1} of 7</span>
            </div>

            <div className="mimi-tour-header-actions">
              <button
                type="button"
                className="mimi-tour-icon-btn"
                title="Play Meow Sound"
                aria-label="Play Meow"
                onClick={handlePlaySound}
              >
                <Volume2 size={13} />
              </button>
              <button
                type="button"
                className="mimi-tour-icon-btn"
                title="Close Tour (Mimi remains on desktop)"
                aria-label="Close tour"
                onClick={() => closeGuide()}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* 7-Step Progress Dots */}
          <div className="mimi-tour-progress-bar">
            {GUIDE_STEPS.map((s, idx) => (
              <div
                key={s.id}
                className={`mimi-tour-step-dot ${
                  idx === guideStepIndex ? 'active' : idx < guideStepIndex ? 'completed' : ''
                }`}
              />
            ))}
          </div>

          {/* Tour Body */}
          <div className="mimi-tour-body">
            <h4 className="mimi-tour-title">{currentStep.title}</h4>
            <p className="mimi-tour-description">{currentStep.description}</p>

            {currentStep.hint && (
              <div className="mimi-tour-hint-box">
                <span className="mimi-tour-hint-text">{currentStep.hint}</span>
              </div>
            )}

            {currentStep.actionLabel && currentStep.actionAppId && (
              <button
                type="button"
                className="mimi-tour-action-btn"
                onClick={() => handleTriggerAction(currentStep.actionAppId)}
              >
                <Sparkles size={12} /> {currentStep.actionLabel}
              </button>
            )}
          </div>

          {/* Tour Navigation Controls */}
          <div className="mimi-tour-nav">
            <button
              type="button"
              className="mimi-tour-nav-btn"
              disabled={guideStepIndex === 0}
              onClick={prevGuideStep}
            >
              <ChevronLeft size={13} /> Back
            </button>

            <button
              type="button"
              className="mimi-tour-nav-btn secondary"
              onClick={skipGuide}
            >
              Skip
            </button>

            <button
              type="button"
              className="mimi-tour-nav-btn primary"
              onClick={isLastStep ? finishGuide : nextGuideStep}
            >
              {isLastStep ? 'Finish' : 'Next'} <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
