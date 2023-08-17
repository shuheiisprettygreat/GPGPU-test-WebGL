#version 300 es
precision mediump float;

in vec2 iTex;

uniform sampler2D depthMap;

out vec4 FragColor;

void main()
{             
    vec4 depthValue = texture(depthMap, iTex);
    FragColor = depthValue; 
}