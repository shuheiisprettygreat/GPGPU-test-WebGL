#version 300 es
precision mediump float;

uniform sampler2D positionTexRead;
uniform sampler2D velocitiesTex;
uniform vec2 texDimensions;
uniform float deltaTime;

out vec4 FragColor;

void main(){
    vec2 texCoord = gl_FragCoord.xy / texDimensions;

    vec3 pos = texture(positionTexRead, texCoord).xyz;
    vec3 vel = texture(velocitiesTex, texCoord).xyz;

    vec3 newPos = pos + vel * deltaTime;

    if(dot(newPos, newPos) > 200.0){
        newPos = vec3(0, 0, 0);
    }

    FragColor = vec4(newPos, 1.0);
 }