import { _events, GameEvent, GameEventType } from "./event";
import { _defaultFont, font_draw_ascii, font_get_text_dimension } from "./font";

let DPR        : number = 1;
let DPI        : number = 1;
let PIXEL_TO_CM: number = DPI * 2.54 / DPR;

export let _gl    : WebGL2RenderingContext  = null as unknown as WebGL2RenderingContext;
export let _canvas: HTMLCanvasElement       = null as unknown as HTMLCanvasElement;

let _currentProgram       : WebGLProgram              = null as unknown as WebGLProgram;
let _currentTexture       : Texture                   = null as unknown as Texture;
let _textureLocation      : WebGLUniformLocation      = null as unknown as WebGLUniformLocation;
let _textureActiveLocation: WebGLUniformLocation      = null as unknown as WebGLUniformLocation;
let _worldMatrixLocation  : WebGLUniformLocation      = null as unknown as WebGLUniformLocation;
let _cameraLocation       : WebGLUniformLocation      = null as unknown as WebGLUniformLocation;
let _vao                  : WebGLVertexArrayObject    = null as unknown as WebGLVertexArrayObject;
let _vbo                  : WebGLBuffer               = null as unknown as WebGLBuffer;
let _ibo                  : WebGLBuffer               = null as unknown as WebGLBuffer;
let _vertices             : Float32Array<ArrayBuffer> = new Float32Array(1 << 20);
let _indexes              : Uint16Array<ArrayBuffer>  = new Uint16Array(1 << 20);
let _verticesCount = 0;
let _indexesCount  = 0;



////////////////////////////////////////////////////////////
export function init_webGL2() : boolean
{
    let div = document.getElementById('dpiMeasure') as HTMLDivElement;
    DPI = div.offsetWidth;
    DPR = window.devicePixelRatio;
    PIXEL_TO_CM = DPI * 2.54 / DPR;


    _canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    if (_canvas === null)
    {
        console.error('Canvas element not found');
        return false;
    }

    _gl = _canvas.getContext('webgl2', { antialias: true })!;
    if (_gl === null)
    {
        console.error('WebGL2 not supported');
        return false;
    }

    _gl.enable(_gl.DEPTH_TEST);
    _gl.depthMask(true);
    _gl.depthFunc(_gl.LEQUAL);

    _gl.enable(_gl.BLEND);
    _gl.blendFunc(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);

    _gl.clearColor(0, 0, 0, 1);

    return true;
}










////////////////////////////////////////////////////////////
// MARK: RECT
////////////////////////////////////////////////////////////
export interface Rect
{
    x: number;
    y: number;
    width : number;
    height: number;
}


////////////////////////////////////////////////////////////
export function to_rect(x: number, y: number, width: number, height: number): Rect
{
    return {x, y, width, height};
}


////////////////////////////////////////////////////////////
export function rect_copy(rect: Rect): Rect
{
    return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
}


////////////////////////////////////////////////////////////
export function rect_contain(r:Rect, x: number, y: number): boolean
{
    return (r.x <= x && x <= r.x + r.width) && (r.y <= y && y <= r.y + r.height);
}


////////////////////////////////////////////////////////////
export function rect_expand(r: Rect, amount: number): Rect
{
    return {
        x: r.x - amount,
        y: r.y - amount,
        width : r.width  + 2*amount,
        height: r.height + 2*amount,
    };
}


////////////////////////////////////////////////////////////
export function rect_expand_x(r: Rect, amount: number): Rect
{
    return {
        x: r.x - amount,
        y: r.y,
        width : r.width + 2*amount,
        height: r.height,
    };
}


////////////////////////////////////////////////////////////
export function rect_expand_y(r: Rect, amount: number): Rect
{
    return {
        x: r.x,
        y: r.y - amount,
        width : r.width,
        height: r.height + 2*amount,
    };
}


////////////////////////////////////////////////////////////
export function rect_shrink(r: Rect, amount: number): Rect
{
    return {
        x: r.x + amount,
        y: r.y + amount,
        width : r.width  - 2*amount,
        height: r.height - 2*amount,
    };
}


////////////////////////////////////////////////////////////
export function rect_shrink_x(r: Rect, amount: number): Rect
{
    return {
        x: r.x + amount,
        y: r.y,
        width : r.width - 2*amount,
        height: r.height,
    };
}


////////////////////////////////////////////////////////////
export function rect_shrink_y(r: Rect, amount: number): Rect
{
    return {
        x: r.x,
        y: r.y + amount,
        width : r.width,
        height: r.height - 2*amount,
    };
}


////////////////////////////////////////////////////////////
export function rect_cut_left(r: Rect, amount: number, margin: number=0): [Rect, Rect] // left, right
{
    let left: Rect =
    {
        x: r.x,
        y: r.y,
        width : amount - 0.5*margin,
        height: r.height,
    };

    let right: Rect =
    {
        x: r.x + amount + 0.5*margin,
        y: r.y,
        width : r.width - amount - 0.5*margin,
        height: r.height,
    };

    return [left, right];
}


////////////////////////////////////////////////////////////
export function rect_cut_right(r: Rect, amount: number, margin: number=0): [Rect, Rect] // left, right
{
    let left: Rect =
    {
        x: r.x,
        y: r.y,
        width : r.width - amount - 0.5*margin,
        height: r.height,
    };

    let right: Rect =
    {
        x: r.x + r.width - amount + 0.5*margin,
        y: r.y,
        width : amount - 0.5*margin,
        height: r.height,
    };

    return [left, right];
}


////////////////////////////////////////////////////////////
export function rect_cut_bottom(r: Rect, amount: number, margin: number=0): [Rect, Rect] // bottom, top
{
    // Beware, in 2D, the y axis starts at the top of the screen
    // Thus, the top of a rect is closer to the bottom of the screen than the top of the screen

    let bottom: Rect =
    {
        x: r.x,
        y: r.y,
        width : r.width,
        height: r.height - amount - 0.5*margin,
    };

    let top: Rect =
    {
        x: r.x,
        y: r.y + amount + 0.5*margin,
        width : r.width,
        height: amount - 0.5*margin,
    };

    return [bottom, top];
}


////////////////////////////////////////////////////////////
export function rect_cut_top(r: Rect, amount: number, margin: number=0): [Rect, Rect] // bottom, top
{
    // Beware, in 2D, the y axis starts at the top of the screen
    // Thus, the top of a rect is closer to the bottom of the screen than the top of the screen

    let bottom: Rect =
    {
        x: r.x,
        y: r.y,
        width : r.width,
        height: amount - 0.5*margin,
    };

    let top: Rect =
    {
        x: r.x,
        y: r.y + amount + 0.5*margin,
        width : r.width,
        height: r.height - amount - 0.5*margin,
    };

    return [bottom, top];
}


////////////////////////////////////////////////////////////
export function rect_does_intersect(r1: Rect, r2: Rect): boolean
{
    return (
            r1.x <= r2.x + r2.width &&
            r1.x + r1.width >= r2.x &&
            r1.y <= r2.y + r2.height &&
            r1.y + r1.height >= r2.y
        );
}


////////////////////////////////////////////////////////////
export function rect_bounding_box(a: Rect, b: Rect): Rect
{
    let x = Math.min(a.x, b.x);
    let y = Math.min(a.y, b.y);

    let x1 = Math.max(a.x+a.width , b.x+b.width);
    let y1 = Math.max(a.y+a.height, b.y+b.height);

    return to_rect(x, y, x1-x, y1-y);
}


////////////////////////////////////////////////////////////
export function rect_intersection(r1: Rect, r2: Rect): Rect
{
    let x = Math.max(r1.x, r2.x);
    let y = Math.max(r1.y, r2.y);

    let width  = Math.max(Math.min(r1.x+r1.width , r2.x+r2.width)  - x, 0);
    let height = Math.max(Math.min(r1.y+r1.height, r2.y+r2.height) - y, 0);

    return {x, y, width, height};
}


////////////////////////////////////////////////////////////
export const enum RectCenterOption
{
    CENTER = 0,
    LEFT   = 1 << 0,
    TOP    = 1 << 1,
    RIGHT  = 1 << 2,
    BOTTOM = 1 << 1,
}

export function rect_center(outer: Rect, inner: Rect, option: RectCenterOption =RectCenterOption.CENTER): Rect
{
    let rect = rect_copy(inner);

    if (option & RectCenterOption.LEFT)
        rect.x = outer.x;
    else if (option & RectCenterOption.RIGHT)
        rect.x = outer.x + outer.width - inner.width;
    else
        rect.x = Math.round(outer.x + (outer.width - inner.width)/2);

    if (option & RectCenterOption.BOTTOM)
        rect.y = outer.y;
    else if (option & RectCenterOption.TOP)
        rect.y = outer.y + outer.height - inner.height;
    else
        rect.y = Math.round(outer.y + (outer.height - inner.height)/2);

    return rect;
}


////////////////////////////////////////////////////////////
export function rect_force_on_screen(r: Rect)
{
    if (r.x + r.width > window.innerWidth)
    {
        r.x = window.innerWidth - r.width;
    }
    if (r.x < 0)
    {
        r.x = 0;
    }

    if (r.y + r.height > window.innerHeight)
    {
        r.y = window.innerHeight - r.height;
    }
    if (r.y < 0)
    {
        r.y = 0;
    }
}















////////////////////////////////////////////////////////////
// MARK: COLOR
////////////////////////////////////////////////////////////
export interface Color
{
    r: number;
    g: number;
    b: number;
    a: number;
}


////////////////////////////////////////////////////////////
export function to_color(r: number, g: number, b: number, a: number): Color
{
    return {r, g, b, a};
}








////////////////////////////////////////////////////////////
// MARK: SHADER
////////////////////////////////////////////////////////////
function shader_compile(source: string, type: number): WebGLShader
{
    if (type !== _gl.VERTEX_SHADER && type !== _gl.FRAGMENT_SHADER)
    {
        console.error(`Wrong shader type. Expect one of [_gl.VERTEX_SHADER, _gl.FRAGMENT_SHADER]`);
        return null as unknown as WebGLShader;
    }

    let shader = _gl.createShader(type)!;
    _gl.shaderSource(shader, source);
    _gl.compileShader(shader);

    if (_gl.getShaderParameter(shader, _gl.COMPILE_STATUS) === false)
    {
        let info     = _gl.getShaderInfoLog(shader);
        let typeRepr = "vertex";
        if (type === _gl.FRAGMENT_SHADER) typeRepr = "fragment";
        console.error(`Cannot compile ${typeRepr} shader: ${info}`);
        _gl.deleteShader(shader);
        shader = null as unknown as WebGLShader;
    }

    return shader
}


////////////////////////////////////////////////////////////
export function shader_create_program(vertexShaderSource: string, fragmentShaderSource: string): WebGLProgram
{
    let program: WebGLProgram = null as unknown as WebGLProgram;

    let vertexShader   = shader_compile(vertexShaderSource  , _gl.VERTEX_SHADER);
    let fragmentShader = shader_compile(fragmentShaderSource, _gl.FRAGMENT_SHADER);

    if (vertexShader !== null && fragmentShader !== null)
    {
        program = _gl.createProgram();

        if (program === null)
        {
            console.error("Cannot create webGL program");
        }
        else
        {
            _gl.attachShader(program, vertexShader);
            _gl.attachShader(program, fragmentShader);
            _gl.linkProgram(program);

            _gl.detachShader(program, vertexShader);
            _gl.detachShader(program, fragmentShader);
            _gl.deleteShader(vertexShader);
            _gl.deleteShader(fragmentShader);

            if (_gl.getProgramParameter(program, _gl.LINK_STATUS) == false)
            {
                let info = _gl.getProgramInfoLog(program);
                console.error(`Cannot link program: ${info}`);
                _gl.deleteProgram(program);
                program = null as unknown as WebGLProgram;
            }
            else
            {
                _currentProgram = program;
                _gl.useProgram(program);

                _textureLocation       = _gl.getUniformLocation(_currentProgram, 'u_texture')       as WebGLUniformLocation;
                _textureActiveLocation = _gl.getUniformLocation(_currentProgram, 'u_textureActive') as WebGLUniformLocation;
                _worldMatrixLocation   = _gl.getUniformLocation(_currentProgram, 'u_projection')    as WebGLUniformLocation;
                _cameraLocation        = _gl.getUniformLocation(_currentProgram, 'u_camera')        as WebGLUniformLocation;

                if (_textureLocation       === null) console.warn("u_texture does not exist in shader");
                if (_textureActiveLocation === null) console.warn("u_textureActive does not exist in shader");
                if (_worldMatrixLocation   === null) console.warn("u_projection does not exist in shader");
                if (_cameraLocation        === null) console.warn("u_camera does not exist in shader");

                camera_none();
            }
        }
    }

    return program;
}









////////////////////////////////////////////////////////////
// MARK: VERTEX
////////////////////////////////////////////////////////////
export function renderer_create_buffers(): boolean
{
    _vao = _gl.createVertexArray();
    if (_vao === null)
    {
        console.error("Cannot create Vertex Array Object (vao)");
        return false;
    }

    _gl.bindVertexArray(_vao);

    _vbo = _gl.createBuffer();
    if (_vbo === null)
    {
        console.error("Cannot create Vertex Buffer Object (vbo)");
        return false;
    }

    _gl.bindBuffer(_gl.ARRAY_BUFFER, _vbo);
    _gl.bufferData(_gl.ARRAY_BUFFER, 1 << 20, _gl.DYNAMIC_DRAW);

    // Position
    _gl.enableVertexAttribArray(0);
    _gl.vertexAttribPointer(0, 3, _gl.FLOAT, false, 9 * 4, 0);

    // Color
    _gl.enableVertexAttribArray(1);
    _gl.vertexAttribPointer(1, 4, _gl.FLOAT, false, 9 * 4, 3 * 4);

    // uv
    _gl.enableVertexAttribArray(2);
    _gl.vertexAttribPointer(2, 2, _gl.FLOAT, false, 9 * 4, (3+4) * 4);

    _ibo = _gl.createBuffer();
    if (_ibo === null)
    {
        console.error("Cannot create Index Buffer Object (ibo)");
        return false;
    }

    _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, _ibo);
    _gl.bufferData(_gl.ELEMENT_ARRAY_BUFFER, 1 << 20, _gl.DYNAMIC_DRAW);

    return true;
}









////////////////////////////////////////////////////////////
// MARK: TEXTURE
////////////////////////////////////////////////////////////
export enum TextureInterpolation
{
    LINEAR  = 0,
    NEAREST = 1,
}


export interface Texture
{
    url: string;

    glTexture    : WebGLTexture;
    width        : number;
    height       : number;
    interpolation: TextureInterpolation;
}

export interface TextureCreationEvent
{
    image  : HTMLImageElement;
    texture: Texture
}




export function texture_load(url: string, interpolation: TextureInterpolation =TextureInterpolation.LINEAR): Texture
{
    let texture: Texture =
    {
        url          : url,
        glTexture    : null as unknown as WebGLTexture,
        width        : 0,
        height       : 0,
        interpolation: interpolation
    };

    let p = new Promise((resolve) =>
    {
        let image = new Image();
        image.onload = () =>
        {
            let eventData: TextureCreationEvent =
            {
                image  : image,
                texture: texture,
            };

            // @ts-ignore
            let event: GameEvent =
            {
                type: GameEventType.INTERNAL_TEXTURE_LOADED,
                data: eventData,
            };

            _events.push(event)

            resolve(null);
        };
        image.onerror = () => { console.error(`Cannot load texture [${url}]`); resolve(null);};
        image.src = url;
    });

    return texture;
}







////////////////////////////////////////////////////////////
// MARK: CAMERA
////////////////////////////////////////////////////////////
let _currentCamera: Float32Array;


////////////////////////////////////////////////////////////
export function camera_none()
{
    renderer_immediate_flush();

    _currentCamera = new Float32Array([
                                            1, 0, 0, 0,
                                            0, 1, 0, 0,
                                            0, 0, 1, 0,
                                            0, 0, 0, 1
                                        ]);
    _gl.uniformMatrix4fv(_cameraLocation, false, _currentCamera);
}


////////////////////////////////////////////////////////////
export function camera_top_down(rect: Rect)
{
    renderer_immediate_flush();

    let scaleX = window.innerWidth  / rect.width;
    let scaleY = window.innerHeight / rect.height;
    let translateX = rect.x;
    let translateY = rect.y;

    _currentCamera = new Float32Array([
                                        scaleX            , 0                 , 0, 0,
                                        0                 , scaleY            , 0, 0,
                                        0                 , 0                 , 1, 0,
                                        -scaleX*translateX, -scaleY*translateY, 0, 1,
                                    ]);

    _gl.uniformMatrix4fv(_cameraLocation, false, _currentCamera);

}






















////////////////////////////////////////////////////////////
// MARK: Cursor
////////////////////////////////////////////////////////////
// https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
export const enum MouseCursor
{
    DEFAULT    = "default",
    POINTER    = "pointer",
    TEXT       = "text",
    NO_ALLOWED = "not-allowed",
    ZOOM_IN    = "zoom-in",
    ZOOM_OUT   = "zoom-out",
}

let _currentCursor = MouseCursor.DEFAULT;
let _nextCursor    = MouseCursor.DEFAULT;


////////////////////////////////////////////////////////////
export function cursor_set(cursor: MouseCursor)
{
    _nextCursor = cursor;
}

















////////////////////////////////////////////////////////////
// MARK: Sprite
////////////////////////////////////////////////////////////
interface Sprite
{
    rect     : Rect;
    textureId: number;
}


let _spriteTextures: Texture[]           = [];
let _spriteMap     : Map<number, Sprite> = new Map();

////////////////////////////////////////////////////////////
export function sprite_load_texture(name: string): number
{
    let spriteTexture   = texture_load(`/ressource/${name}.png`);
    let spriteTextureId = -1;
    if (spriteTexture !== null)
    {
        spriteTextureId = _spriteTextures.length;
        _spriteTextures.push(spriteTexture);
    }

    return spriteTextureId;
}


////////////////////////////////////////////////////////////
export function sprite_register(key: number, spriteTextureId: number, x: number, y: number, width: number, height: number)
{
    let sprite: Sprite =
    {
        rect     : to_rect(x, y, width, height),
        textureId: spriteTextureId
    };

    _spriteMap.set(key, sprite);
}


////////////////////////////////////////////////////////////
export function sprite_get(key: number): Sprite
{
    let sprite = _spriteMap.get(key);
    if (sprite === undefined)
        sprite = {rect: to_rect(0, 0, 0, 0), textureId: 0};

    return sprite;
}


////////////////////////////////////////////////////////////
export function sprite_texture(sprite: Sprite): Texture
{
    return _spriteTextures[sprite.textureId];
}


















////////////////////////////////////////////////////////////
// MARK: Scissor
////////////////////////////////////////////////////////////
let _scissors       : Rect[]  = [];
let _isScissorEnable: boolean = false;


////////////////////////////////////////////////////////////
export function renderer_scissor_push(r: Rect)
{
    renderer_immediate_flush();

    if (_isScissorEnable === false) _gl.enable(_gl.SCISSOR_TEST);
    _isScissorEnable = true;

    let topOfScissorStack = r;
    if (_scissors.length > 0) topOfScissorStack = _scissors[_scissors.length - 1];
    let newScissor = rect_intersection(topOfScissorStack, r);

    _scissors.push(newScissor);
    // OpenGL coord are fucked up.....
    _gl.scissor(newScissor.x, _canvas.height - newScissor.y - newScissor.height, newScissor.width, newScissor.height);
}


////////////////////////////////////////////////////////////
export function renderer_scissor_pop()
{
    renderer_immediate_flush();

    _scissors.pop();
    if (_scissors.length === 0)
    {
        _gl.disable(_gl.SCISSOR_TEST);
        _isScissorEnable = false;
    }
    else
    {
        let r = _scissors[_scissors.length - 1];
        _gl.scissor(r.x, _canvas.height - r.y - r.height, r.width, r.height);
    }
}















////////////////////////////////////////////////////////////
// MARK: DRAW
////////////////////////////////////////////////////////////
export function draw_rect(rect: Rect, z: number, color: Color)
{
    renderer_set_texture(null);

    let x0 = rect.x;
    let y0 = rect.y;
    let x1 = rect.x + rect.width;
    let y1 = rect.y + rect.height;

    let bottomRect = to_rect(x0 + 1, y0, x1-(x0 + 1), 1);
    let leftRect = to_rect(x0, y0, 1, y1 - y0);
    let rightRect = to_rect(x1 - 1, y0, 1, y1 - y0);
    let topRect = to_rect(x0 + 1, y1-1, x1-(x0 + 1), 1);

    // _vertex_buffer_draw_colored_quad(vertexBuffer, rect->x0 + 1.f, rect->y0 + 1.f, rect->x1, rect->y0, rect->z, rect->color); // bottom
    // _vertex_buffer_draw_colored_quad(vertexBuffer, rect->x0 + 1.f, rect->y0      , rect->x0, rect->y1, rect->z, rect->color); // left
    // _vertex_buffer_draw_colored_quad(vertexBuffer, rect->x1 - 1.f, rect->y1      , rect->x1, rect->y0, rect->z, rect->color); // right
    // _vertex_buffer_draw_colored_quad(vertexBuffer, rect->x0 + 1.f, rect->y1 - 1.f, rect->x1, rect->y1, rect->z, rect->color); // top

    draw_quad(bottomRect, z, color); // bottom
    draw_quad(leftRect, z, color); // left
    draw_quad(rightRect, z, color); // right
    draw_quad(topRect, z, color); // top
}


////////////////////////////////////////////////////////////
export function draw_quad(rect: Rect, z: number, color: Color)
{
    renderer_set_texture(null);

    let left   = rect.x;
    let top    = rect.y;
    let right  = rect.x + rect.width;
    let bottom = rect.y + rect.height;

    {
        let i = _verticesCount;

        // Point 1
        _vertices[i] = left  ; i += 1;
        _vertices[i] = bottom; i += 1;
        _vertices[i] = z     ; i += 1;

        _vertices[i] = color.r; i += 1;
        _vertices[i] = color.g; i += 1;
        _vertices[i] = color.b; i += 1;
        _vertices[i] = color.a; i += 1;

        _vertices[i] = -1; i += 1;
        _vertices[i] = -1; i += 1;
        // _vertices[i] =  0; i += 1;

        // Point 2
        _vertices[i] = left; i += 1;
        _vertices[i] = top ; i += 1;
        _vertices[i] = z   ; i += 1;

        _vertices[i] = color.r; i += 1;
        _vertices[i] = color.g; i += 1;
        _vertices[i] = color.b; i += 1;
        _vertices[i] = color.a; i += 1;

        _vertices[i] = -1; i += 1;
        _vertices[i] = -1; i += 1;
        // _vertices[i] =  0; i += 1;

        // Point 3
        _vertices[i] = right ; i += 1;
        _vertices[i] = bottom; i += 1;
        _vertices[i] = z     ; i += 1;

        _vertices[i] = color.r; i += 1;
        _vertices[i] = color.g; i += 1;
        _vertices[i] = color.b; i += 1;
        _vertices[i] = color.a; i += 1;

        _vertices[i] = -1; i += 1;
        _vertices[i] = -1; i += 1;
        // _vertices[i] =  0; i += 1;

        // Point 4
        _vertices[i] = right; i += 1;
        _vertices[i] = top  ; i += 1;
        _vertices[i] = z    ; i += 1;

        _vertices[i] = color.r; i += 1;
        _vertices[i] = color.g; i += 1;
        _vertices[i] = color.b; i += 1;
        _vertices[i] = color.a; i += 1;

        _vertices[i] = -1; i += 1;
        _vertices[i] = -1; i += 1;
        // _vertices[i] =  0; i += 1;
    }

    {
        let i           = _indexesCount;
        let vertexIndex = _verticesCount / 9;

        _indexes[i + 0] = vertexIndex + 0;
        _indexes[i + 1] = vertexIndex + 1;
        _indexes[i + 2] = vertexIndex + 2;

        _indexes[i + 3] = vertexIndex + 1;
        _indexes[i + 4] = vertexIndex + 2;
        _indexes[i + 5] = vertexIndex + 3;
    }

    _verticesCount += 4 * 9;
    _indexesCount  += 6;
}


////////////////////////////////////////////////////////////
export function draw_sprite(rect: Rect, z: number, texture: Texture, uv: Rect =to_rect(0, 0, texture.width, texture.height), color: Color =to_color(1, 1, 1, 1))
{
    if (texture.glTexture === null) return;
    renderer_set_texture(texture);

    let left   = rect.x;
    let top    = rect.y;
    let right  = rect.x + rect.width;
    let bottom = rect.y + rect.height;

    let textureLeft   = (uv.x) / texture.width;
    let textureTop    = (uv.y) / texture.height;
    let textureRight  = (uv.x + uv.width)  / texture.width;
    let textureBottom = (uv.y + uv.height) / texture.height;

    {
        let i = _verticesCount;

        // Point 1
        _vertices[i] = left  ; i += 1;
        _vertices[i] = bottom; i += 1;
        _vertices[i] = z     ; i += 1;

        _vertices[i] = color.r; i += 1;
        _vertices[i] = color.g; i += 1;
        _vertices[i] = color.b; i += 1;
        _vertices[i] = color.a; i += 1;

        _vertices[i] = textureLeft  ; i += 1;
        _vertices[i] = textureBottom; i += 1;
        // _vertices[i] =  0; i += 1;

        // Point 2
        _vertices[i] = left; i += 1;
        _vertices[i] = top ; i += 1;
        _vertices[i] = z   ; i += 1;

        _vertices[i] = color.r; i += 1;
        _vertices[i] = color.g; i += 1;
        _vertices[i] = color.b; i += 1;
        _vertices[i] = color.a; i += 1;

        _vertices[i] = textureLeft; i += 1;
        _vertices[i] = textureTop ; i += 1;
        // _vertices[i] =  0; i += 1;

        // Point 3
        _vertices[i] = right ; i += 1;
        _vertices[i] = bottom; i += 1;
        _vertices[i] = z     ; i += 1;

        _vertices[i] = color.r; i += 1;
        _vertices[i] = color.g; i += 1;
        _vertices[i] = color.b; i += 1;
        _vertices[i] = color.a; i += 1;

        _vertices[i] = textureRight ; i += 1;
        _vertices[i] = textureBottom; i += 1;
        // _vertices[i] =  0; i += 1;

        // Point 4
        _vertices[i] = right; i += 1;
        _vertices[i] = top  ; i += 1;
        _vertices[i] = z    ; i += 1;

        _vertices[i] = color.r; i += 1;
        _vertices[i] = color.g; i += 1;
        _vertices[i] = color.b; i += 1;
        _vertices[i] = color.a; i += 1;

        _vertices[i] = textureRight; i += 1;
        _vertices[i] = textureTop  ; i += 1;
        // _vertices[i] =  0; i += 1;
    }

    {
        let i           = _indexesCount;
        let vertexIndex = _verticesCount / 9;

        _indexes[i + 0] = vertexIndex + 0;
        _indexes[i + 1] = vertexIndex + 1;
        _indexes[i + 2] = vertexIndex + 2;

        _indexes[i + 3] = vertexIndex + 1;
        _indexes[i + 4] = vertexIndex + 3;
        _indexes[i + 5] = vertexIndex + 2;
    }

    _verticesCount += 4 * 9;
    _indexesCount  += 6;
}


////////////////////////////////////////////////////////////
// export function draw_text(rect: Rect, z: number, s: string, color: Color =to_color(1, 1, 1, 1))
// {
//     let x     = rect.x;
//     let y     = rect.y;
//     let scale = 4;

//     for (let i=0; i < s.length ; i+=1)
//     {
//         font_draw_ascii(x, y, z, scale, s[i], color);
//         x += 6*scale;
//     }
// }


////////////////////////////////////////////////////////////
export function draw_text(x: number, y: number, z: number, s: string, color: Color =to_color(1, 1, 1, 1))
{
    let scale = 4;

    for (let i=0; i < s.length ; i+=1)
    {
        font_draw_ascii(x, y, z, _defaultFont, scale, s[i], color);
        x += 6*scale;
    }
}


////////////////////////////////////////////////////////////
export const enum TextDrawOption
{
    // Should match RectCenterOption
    CENTER = 0,
    LEFT   = 1 << 0,
    RIGHT  = 1 << 1,
    BOTTOM = 1 << 2,
    TOP    = 1 << 3,
}

export function draw_text_in_rect(rect: Rect , z: number, s: string, scale: number, option: TextDrawOption =TextDrawOption.CENTER, color: Color =to_color(1, 1, 1, 1))
{
    let textBoundingRect = font_get_text_dimension(s, _defaultFont, scale);
    let correctTextRect  = rect_center(rect, textBoundingRect, (option & 0b1111) as unknown as RectCenterOption);

    let x = correctTextRect.x;
    let y = correctTextRect.y;

    for (let i=0; i < s.length ; i+=1)
    {
        font_draw_ascii(x, y, z, _defaultFont, scale, s[i], color);
        x += 6*scale;
    }
}






////////////////////////////////////////////////////////////
// MARK: IM
////////////////////////////////////////////////////////////
export function renderer_get_window_info(): [Rect, number, number]
{
    let windowWidth  = window.innerWidth;
    let windowHeight = window.innerHeight;

    if (_canvas.width !== windowWidth || _canvas.height !== windowHeight)
    {
        let matrix = new Float32Array([
                2 / windowWidth, 0, 0, 0,
                0, -2 / windowHeight, 0, 0,
                0, 0, 1, 0,
                -1, 1, 0, 1
            ]);

        _canvas.width  = windowWidth;
        _canvas.height = windowHeight;
        _gl.viewport(0, 0, windowWidth, windowHeight);

        _gl.uniformMatrix4fv(_worldMatrixLocation, false, matrix);
    }

    return [to_rect(0, 0, windowWidth, windowHeight), windowWidth * PIXEL_TO_CM, windowHeight * PIXEL_TO_CM];
}


////////////////////////////////////////////////////////////
export function renderer_start_frame()
{
    if (_nextCursor !== _currentCursor)
    {
        _currentCursor       = _nextCursor
        _canvas.style.cursor = _currentCursor;
    }

    _scissors.splice(0, _scissors.length);
    _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);
    _nextCursor = MouseCursor.DEFAULT;
}


////////////////////////////////////////////////////////////
export function renderer_set_texture(nextTexture: Texture | null)
{
    if (_currentTexture !== nextTexture)
    {
        renderer_immediate_flush();

        if (nextTexture !== null)
        {
            _gl.activeTexture(_gl.TEXTURE0);
            _gl.bindTexture(_gl.TEXTURE_2D, nextTexture.glTexture);

            _gl.uniform1i(_textureActiveLocation, 1);
            _gl.uniform1i(_textureLocation, 0);
        }
        else
        {
            _gl.uniform1i(_textureActiveLocation, 0);
        }

        _currentTexture = nextTexture as Texture;
    }
}


////////////////////////////////////////////////////////////
export function renderer_immediate_flush()
{
    if (_verticesCount === 0) return;

    _gl.bufferSubData(_gl.ARRAY_BUFFER        , 0, _vertices, 0, _verticesCount);
    _gl.bufferSubData(_gl.ELEMENT_ARRAY_BUFFER, 0, _indexes , 0, _indexesCount);
    _gl.drawElements(_gl.TRIANGLES, _indexesCount, _gl.UNSIGNED_SHORT, 0);

    _gl.flush();

    _verticesCount = 0;
    _indexesCount  = 0;
}