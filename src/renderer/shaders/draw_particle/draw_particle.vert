#version 300 es
precision mediump float;

// Attributes
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aTex;

uniform float id;
uniform sampler2D positionTex;
uniform vec2 texDimentions;
uniform mat4 view;
uniform mat4 proj;
uniform mat4 model;


vec4 getValueFrom2DTexture(sampler2D tex, vec2 dim, float id){
    float y = floor(id/dim.x);
    float x = mod(id, dim.x);
    vec2 texCoord = (vec2(x, y) + 0.5) / dim;
    return texture(tex, texCoord);
}


void main(){
    vec4 position = getValueFrom2DTexture(positionTex, texDimentions, id);

    // scale and rotation are given with model matrix.
    vec4 pos = model * vec4(aPos, 1.0);

    pos.xyz += position.xyz;

    gl_Position = proj * view * pos;
}
