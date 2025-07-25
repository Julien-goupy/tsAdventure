#version 300 es
precision highp float;

layout(location=0) in vec3 position;
layout(location=1) in vec4 color;
layout(location=2) in vec2 uv;

uniform mat4 u_projection;
uniform mat4 u_camera;

out highp vec4 outColor;
out highp vec2 outUv;


void main()
{
    gl_Position = u_projection * (u_camera * vec4(position.x, position.y, -position.z/2000.0, 1.0));
    outColor    = color;
    outUv       = uv;
}