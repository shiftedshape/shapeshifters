---
title: "Shader Media"
category: webgl
tools:
  - framer
  - code
summary: "WebGL · 3 effects for images and video"
excerpt: "Prism splits the colour, Pixel smears a grid behind the pointer, Halftone turns your image or video into print dots."
free: false
color: lilac
motif: dots
demoUrl: "https://fx.shiftedshape.com/embed/shader-media/?mode=halftone"
demoEmbed: true
demoAspect: "3/2"
inside:
  - count: "3"
    label: "Looks"
    text: "Prism, Pixel and Halftone, each with its own settings."
  - count: "3"
    label: "Triggers"
    text: "Hover, scroll or always on."
  - count: "2"
    label: "Versions"
    text: "Framer component and plain JavaScript."
specs:
  - label: "Tech"
    value: "WebGL, no dependencies"
  - label: "Fallback"
    value: "Shows the plain image where WebGL isn't available"
featured: false
comingSoon: true
order: 11
---

Put an image or a video in, pick a look, and choose what brings it to life: hovering, scrolling, or always on.

## Three looks

- **Prism**: the picture waves and splits into red, green and blue around the pointer.
- **Pixel**: a grid of cells that smear and fringe in the direction you move.
- **Halftone**: print dots in ink on paper, or in the image's own colours. The pointer magnifies the dots or reveals the photo underneath.

## Details

- Scroll modes: resolve towards the middle of the screen, build up while scrolling, or react to scroll speed
- Optional black and white until hovered, and a cursor dot
- Pauses off screen; shows the plain image where WebGL isn't available

## What's included

- Framer component with every setting in the properties panel
- JavaScript version for any website, with no dependencies
- Example page and a playground
