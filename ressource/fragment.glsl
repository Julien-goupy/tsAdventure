#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform int       u_textureActive;

in highp vec4 outColor;
in highp vec2 outUv;

out vec4 fragColor;

void main()
{
    if (u_textureActive == 0)
    {
        fragColor = outColor;
    }
    else
    {
        fragColor = outColor * texture(u_texture, outUv);
    }
}