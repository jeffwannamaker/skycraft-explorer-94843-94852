# Skycraft Explorer - 3D Airplane Game (React)

Immerse yourself in a procedurally generated 3D world with a blocky, Minecraft-inspired style! Pilot a simple airplane over rolling terrain, takeoff from the runway, soar among clouds, dodge trees and buildings, and enjoy a minimalist modern UI.

## Features

- 🛫 **Third-person airplane piloting** with engine start (Space) and full flight controls (arrow keys)
- ⛰️ **Procedural terrain** with hills, valleys, and randomly placed trees & buildings
- ☁️ **Dynamic clouds and sky** for atmospheric flying
- 🎮 **Performance optimized** with frame interpolation and chunked world
- 🖥️ **Fullscreen game canvas** and overlays for controls/instructions
- 🧑‍💻 **Modern, minimal UI** theme with accent colors

## Controls

- **Spacebar:** Start/stop engine
- **Arrow Up/Down:** Pitch up/down (ascend/descend)
- **Arrow Left/Right:** Turn (yaw) left/right
- **[Instructions]** in overlay will show more tips!

> 🚨 If you crash (fly below the ground), you respawn at the runway!

## Getting Started

```bash
npm install
npm start
```
Then visit [http://localhost:3000](http://localhost:3000)

## Dependencies

- [React](https://reactjs.org/)
- [three.js](https://threejs.org/) via [react-three-fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/)
- [@react-three/drei](https://drei.pmnd.rs/)
- [simplex-noise](https://github.com/jwagner/simplex-noise.js)

## Customization

Project colors:  
- Primary: `#2196f3`
- Secondary: `#4caf50`
- Accent: `#ffeb3b`

Explore and enjoy flying!
