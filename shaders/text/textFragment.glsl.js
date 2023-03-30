const fragmentShader = `
    // Varyings
    varying vec2 vUv;

    // Uniforms: Common
    uniform float uOpacity;
    uniform float uThreshold;
    uniform float uAlphaTest;
    uniform sampler2D uMap;
    uniform sampler2D uGradientMap;
    uniform vec3 uColor;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform vec2 viewport;

    // Uniforms: Strokes
    uniform vec3 uStrokeColor;
    uniform float uStrokeOutsetWidth;
    uniform float uStrokeInsetWidth;

    // Utils: Median
    float median(float r, float g, float b) {
        return max(min(r, g), min(max(r, g), b));
    }

    float createCircle(){
        vec2 viewportUv = gl_FragCoord.xy / viewport;
        float viewportAspect = viewport.x / viewport.y;

        vec2 mousePoint = vec2(uMouse.x, 1. - uMouse.y);
        float circleRadius = max(0., 100. / viewport.x);

        vec2 shapeUv = viewportUv - mousePoint;
        shapeUv /= vec2(1., viewportAspect);
        shapeUv += mousePoint;

        float dist = distance(shapeUv, mousePoint);
        dist = smoothstep(circleRadius, circleRadius + 0.001, dist);
        return dist;
    }

    void main() {
        // Texture sample
        vec3 s = texture2D(uMap, vUv).rgb;
        float gradient = texture2D(uGradientMap, vUv).r;

        // Signed distance
        float sigDist = median(s.r, s.g, s.b) - 0.5;
        float afwidth = 1.4142135623730951 / 2.0;
        #ifdef IS_SMALL
            float fill = smoothstep(uThreshold - afwidth, uThreshold + afwidth, sigDist);
        #else
            float fill = clamp(sigDist / fwidth(sigDist) + 0.5, 0.0, 1.0);
        #endif

        // Strokes
        float border = fwidth(sigDist);
        float outline = smoothstep(0., border, sigDist);
        outline *= 1. - smoothstep(uStrokeOutsetWidth - border, uStrokeOutsetWidth, sigDist);

        // Gradient
        float lineWidth = 0.3;
        float grgr = fract(2. * gradient + uTime * 0.1);

        float start = smoothstep(0., 0.001, grgr);
        float end = smoothstep(lineWidth, lineWidth - 0.001, grgr);
        float mask = start * end;
        mask = max(0.2, mask);

        // Circle
        float circle = createCircle();

        float finalAlpha = outline * mask + fill * circle;

        // Alpha Test
        if (fill < uAlphaTest) discard;

        // Output
        vec4 filledFragColor = vec4(uColor, finalAlpha);
        // vec4 filledFragColor = vec4(uColor, uOpacity * fill);
        // filledFragColor = vec4(vec3(outline), fill);
        // filledFragColor = vec4(vec3(circle), 1.);
        
        gl_FragColor = filledFragColor;
    }
`;

export default fragmentShader;
