import { editor_launch } from "./controler/editor";
import { event_init } from "./event";
import { font_init } from "./font";
import { game_render_one_frame } from "./logic";
import { init_webGL2, renderer_create_buffers, shader_create_program, to_rect } from "./renderer";



async function main()
{

    // init
    if (init_webGL2() === false) return;

    //  shaders
    let [vertexShaderResponse, fragmentShaderResponse] = await Promise.all([fetch("/ressource/vertex.glsl"), fetch("/ressource/fragment.glsl")]);
    if (vertexShaderResponse.ok === false)
    {
        console.error(`Failed to fetch vertex shader source.`);
        return;
    }
    if (fragmentShaderResponse.ok === false)
    {
        console.error(`Failed to fetch fragment shader source.`);
        return;
    }

    const vertexShaderSource   = await vertexShaderResponse.text();
    const fragmentShaderSource = await fragmentShaderResponse.text();

    let program = shader_create_program(vertexShaderSource, fragmentShaderSource);
    if (program === null) return;

    if (renderer_create_buffers() === false) return;

    event_init();


    await font_init();

    // run
    editor_launch();

    requestAnimationFrame(game_render_one_frame);
}

document.addEventListener('DOMContentLoaded', main);