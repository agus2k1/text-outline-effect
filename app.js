import './main.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import fragment from './shaders/fragment.glsl.js';
import vertex from './shaders/vertex.glsl.js';
import textFragment from './shaders/text/textFragment.glsl';
import textVertex from './shaders/text/textVertex.glsl';
import {
  MSDFTextGeometry,
  MSDFTextMaterial,
  uniforms,
} from 'three-msdf-text-utils';
import fnt from './fonts/Manifold/manifold-msdf.json';
import png from './fonts/Manifold/manifold.png';
import gradientTexture from './fonts/gradient-map.png';

export default class Sketch {
  constructor() {
    this.scene = new THREE.Scene();
    this.container = document.getElementById('container');
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x333333, 1);
    this.renderer.useLegacyLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.001,
      1000
    );
    this.camera.position.set(0, 0, 2);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.time = 0;
    this.mouse = { x: 0, y: 0 };

    this.addMesh();
    this.addText();
    this.mouseEvents();
    this.render();
    // this.setupResize();
    // this.resize();
  }

  setupResize() {
    window.addEventListener('resize', this.resize.bind(this));
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;

    // image cover
    this.imageAspect = 853 / 1280;
    let a1;
    let a2;
    if (this.height / this.width > this.imageAspect) {
      a1 = (this.width / this.height) * this.imageAspect;
      a2 = 1;
    } else {
      a1 = 1;
      a2 = this.height / this.width / this.imageAspect;
    }

    this.material.uniforms.resolution.value.x = this.width;
    this.material.uniforms.resolution.value.y = this.height;
    this.material.uniforms.resolution.value.z = a1;
    this.material.uniforms.resolution.value.w = a2;

    // optional - cover with quad
    const distance = this.camera.position.z;
    const height = 1;
    this.camera.fov = 2 * (180 / Math.PI) * Math.atan(height / (2 * distance));

    // if (w/h > 1)
    if (this.width / this.height > 1) {
      this.plane.scale.x = this.camera.aspect;
    } else {
      this.plane.scale.y = 1 / this.camera.aspect;
    }

    this.camera.updateProjectionMatrix();
  }

  mouseEvents() {
    window.addEventListener('mousemove', (e) => {
      this.mouse = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
      if (this.textMaterial && this.pointsMaterial) {
        this.textMaterial.uniforms.uMouse.value = new THREE.Vector2(
          this.mouse.x,
          this.mouse.y
        );
        this.pointsMaterial.uniforms.uMouse.value = new THREE.Vector2(
          this.mouse.x,
          this.mouse.y
        );
      }
    });
  }

  addMesh() {
    let number = 1000;
    let geo = new THREE.BufferGeometry();
    let pos = [];

    for (let i = 0; i < number; i++) {
      let x = 4 * (Math.random() - 0.5);
      let y = 4 * (Math.random() - 0.5);
      let z = Math.random() - 0.5;

      pos.push(x, y, z);
    }

    pos = new Float32Array(pos);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    this.pointsMaterial = new THREE.ShaderMaterial({
      extensions: {
        derivatives: '#extension GL_OES_standard_derivatives : enable',
      },
      uniforms: {
        time: { value: 0 },
        uMouse: {
          value: new THREE.Vector2(0, 0),
        },
        viewport: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        resolution: { value: new THREE.Vector4() },
      },
      fragmentShader: fragment,
      vertexShader: vertex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    // this.pointsGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);

    this.points = new THREE.Points(geo, this.pointsMaterial);
    this.scene.add(this.points);
  }

  addText() {
    Promise.all([loadFontAtlas(png)]).then(([atlas]) => {
      const geometry = new MSDFTextGeometry({
        text: 'GOOD\nNIGHT',
        font: fnt,
      });

      geometry.computeBoundingBox();

      this.textMaterial = new THREE.ShaderMaterial({
        defines: {
          IS_SMALL: false,
        },
        extensions: {
          derivatives: true,
        },
        uniforms: {
          // Common
          ...uniforms.common,

          // Rendering
          ...uniforms.rendering,

          // Strokes
          ...uniforms.strokes,
          ...{
            uColor: { value: new THREE.Color(0xffffff) },
            uTime: { value: 0 },
            uStrokeColor: { value: new THREE.Color(0x0abf3a) },
            uStrokeOutsetWidth: { value: 0.1 },
            // uStrokeInsetWidth: { value: 0.1 },
            uGradientMap: {
              value: new THREE.TextureLoader().load(gradientTexture),
            },
            uMouse: {
              value: new THREE.Vector2(0, 0),
            },
            viewport: {
              value: new THREE.Vector2(window.innerWidth, window.innerHeight),
            },
          },
        },
        vertexShader: textVertex,
        fragmentShader: textFragment,
        side: THREE.DoubleSide,
        transparent: true,
      });

      this.textMaterial.uniforms.uMap.value = atlas;

      const mesh = new THREE.Mesh(geometry, this.textMaterial);
      mesh.name = 'text';
      mesh.scale.set(0.02, -0.02, 0.02);
      mesh.position.x = -1.5;
      this.scene.add(mesh);
    });

    function loadFontAtlas(path) {
      const promise = new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(path, resolve);
      });

      return promise;
    }
  }

  render() {
    this.time += 0.05;
    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(this.render.bind(this));
    if (this.scene.children[1]?.material) {
      this.scene.children[1].material.uniforms.uTime.value = this.time;
    }
  }
}

new Sketch();
