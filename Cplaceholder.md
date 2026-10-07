# MimiOS Asset Placeholders & Replacement Registry

This document records all temporary and placeholder assets introduced during the MimiOS Boot Experience and Visual Identity phases. Future designers and developers can use this guide to drop in official assets without breaking paths or code references.

---

## Placeholder Assets Overview

| Placeholder | Current Location | Purpose | Recommended File Format | Code Reference | Drop-in Compatible? |
|-------------|------------------|---------|-------------------------|----------------|---------------------|
| **MCORP Manufacturer Logo** | `/public/assets/branding/mcorp-logo.svg` | Hardware vendor BIOS/firmware splash | Vector SVG (monochrome/transparent) | `McorpSplash.tsx` | Yes (same path) |
| **MimiOS Operating System Logo** | `/public/assets/branding/mimios-logo.svg` | Official OS splash & login header | Vector SVG or high-res PNG (240×240+) | `MimiOSSplash.tsx`, `LoginScreen.tsx` | Yes (same path) |
| **MimiOS Running Boot Cat** | `/public/assets/branding/mimios-boot-cat.svg` | Animated cat traversing the loading track during OS splash | SVG / animated SVG / Lottie | `MimiOSSplash.tsx`, `Boot.css` | Yes (same path) |
| **User Profile / Avatar** | `/public/assets/branding/user-avatar.svg` | Default avatar on login screen & lock screen | SVG or circular WebP/PNG (120×120+) | `LoginScreen.tsx` | Yes (same path) |
| **Hardware Startup Audio** | `/public/assets/audio/boot-startup-placeholder.mp3` | Power-on machine chime | MP3 / OGG audio (0.5s–1.5s, 44.1kHz) | `bootSound.ts` | Yes (same path) |

---

## Detailed Asset Specifications & Replacement Instructions

### 1. MCORP Manufacturer Logo
- **Current Path:** `public/assets/branding/mcorp-logo.svg`
- **Component Referencing It:** `src/components/boot/McorpSplash.tsx`
- **What it Represents:** Fictional laptop manufacturer firmware branding (MCORP / M-CORP COMPUTING).
- **Target Format:** SVG (scalable vector), transparent background.
- **Recommended Dimensions:** Aspect ratio roughly 4:1 (e.g. 480×120px viewBox).
- **Color Recommendation:** Monochrome (#FFFFFF, #9CA3AF, subtle opacity).
- **Replacement Procedure:** Overwrite `public/assets/branding/mcorp-logo.svg`. No code changes required.

---

### 2. MimiOS Operating System Logo
- **Current Path:** `public/assets/branding/mimios-logo.svg`
- **Components Referencing It:** `src/components/boot/MimiOSSplash.tsx`, `src/components/boot/LoginScreen.tsx`
- **What it Represents:** Official MimiOS operating system mark.
- **Target Format:** SVG (scalable vector) or PNG (minimum 512×512px).
- **Recommended Dimensions:** Square 1:1 aspect ratio (e.g. 240×240px viewBox).
- **Color Recommendation:** Monochrome or subtle cool silver / off-white (#FFFFFF / #E2E8F0) with transparent background.
- **Replacement Procedure:** Overwrite `public/assets/branding/mimios-logo.svg`. No code changes required.

---

### 3. MimiOS Running Boot Cat
- **Current Path:** `public/assets/branding/mimios-boot-cat.svg`
- **Components Referencing It:** `src/components/boot/MimiOSSplash.tsx`, `src/components/boot/Boot.css`
- **What it Represents:** Leaping/running cat traversing the loading track line during the MimiOS OS loading stage.
- **Target Format:** SVG vector (running silhouette) or animated SVG/Lottie.
- **Recommended Dimensions:** Roughly 2:1 aspect ratio (e.g. 64×36px viewBox).
- **Color Recommendation:** Off-white (#F8FAFC) or white with subtle opacity.
- **Replacement Procedure:** Overwrite `public/assets/branding/mimios-boot-cat.svg`. The CSS runner in `Boot.css` smoothly drives horizontal translation across the track line while animating subtle vertical running strides.

---

### 4. User Avatar / Profile Image
- **Current Path:** `public/assets/branding/user-avatar.svg`
- **Components Referencing It:** `src/components/boot/LoginScreen.tsx`
- **What it Represents:** Default profile silhouette when no custom user name or initial is provided.
- **Target Format:** SVG, PNG, or WebP.
- **Recommended Dimensions:** Square 1:1 aspect ratio (e.g. 120×120px to 256×256px).
- **Replacement Procedure:** Overwrite `public/assets/branding/user-avatar.svg`. Preserves circular masking and frosted glass border automatically.

---

### 5. Hardware Startup Audio Chime
- **Current Path:** `public/assets/audio/boot-startup-placeholder.mp3`
- **Utility Referencing It:** `src/lib/audio/bootSound.ts`
- **What it Represents:** Physical laptop POST / firmware startup sound played when the power button is pressed.
- **Target Format:** MP3 or OGG (44.1kHz stereo, lightweight < 150KB).
- **Recommended Duration:** 0.6 seconds to 1.8 seconds (gentle subtle chime, e.g. classic workstation boot tone).
- **Resilience / Fallback:** If the MP3 file is missing, silent, or blocked, `bootSound.ts` automatically synthesizes a gentle 3-harmonic sine chord via Web Audio API (`C4-G4-C5`), guaranteeing no unhandled exceptions.
- **Replacement Procedure:** Place your final MP3 file at `public/assets/audio/boot-startup-placeholder.mp3`.
