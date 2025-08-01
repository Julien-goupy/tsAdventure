import {Platform, platform_get} from "./logic";
import { _canvas, _gl, renderer_set_texture, Texture, TextureCreationEvent, TextureInterpolation } from "./renderer";

export const enum GameEventType
{
    NONE       = 0,
    KEY        = 1,
    WEB_SOCKET = 2,

    INTERNAL_TEXTURE_LOADED = 16,
}

export const enum GameEventKey
{
    NONE = -1,

    START_OF_KEYBOARD = 0,

    _A = 65,
    _B = 66,
    _C = 67,
    _D = 68,
    _E = 69,
    _F = 70,
    _G = 71,
    _H = 72,
    _I = 73,
    _J = 74,
    _K = 75,
    _L = 76,
    _M = 77,
    _N = 78,
    _O = 79,
    _P = 80,
    _Q = 81,
    _R = 82,
    _S = 83,
    _T = 84,
    _U = 85,
    _V = 86,
    _W = 87,
    _X = 88,
    _Y = 89,
    _Z = 90,

    _a = 97,
    _b = 98,
    _c = 99,
    _d = 100,
    _e = 101,
    _f = 102,
    _g = 103,
    _h = 104,
    _i = 105,
    _j = 106,
    _k = 107,
    _l = 108,
    _m = 109,
    _n = 110,
    _o = 111,
    _p = 112,
    _q = 113,
    _r = 114,
    _s = 115,
    _t = 116,
    _u = 117,
    _v = 118,
    _w = 119,
    _x = 120,
    _y = 121,
    _z = 122,

    ARROW_LEFT  = 256,
    ARROW_UP    = 257,
    ARROW_RIGHT = 258,
    ARROW_DOWN  = 259,

    TAB           = 260,
    ENTER         = 261,
    ESCAPE        = 262,
    DELETE        = 263,
    BACKSPACE     = 264,
    INSERT        = 265,
    END           = 266,
    HOME          = 267,
    PAGE_UP       = 268,
    PAGE_DOWN     = 269,
    SHIFT         = 270,
    CAPS_LOCK     = 271,
    CONTROL       = 272,
    RIGHT_CONTROL = 273,
    ALT           = 274,
    ALT_GR        = 275,
    META          = 276, // window key on windows

    COPY       = 290,
    CUT        = 291,
    PASTE      = 296,
    UNDO       = 293,
    REDO       = 294,
    SELECT_ALL = 295,

    F1  = 301,
    F2  = 302,
    F3  = 303,
    F4  = 304,
    F5  = 305,
    F6  = 306,
    F7  = 307,
    F8  = 308,
    F9  = 309,
    F10 = 310,
    F11 = 311,
    F12 = 312,

    END_OF_KEYBOARD = 320,

    MOUSSE_LEFT   = 320,
    MOUSSE_MIDDLE = 321, // scroll click
    MOUSSE_RIGHT  = 322,
    MOUSSE_4      = 323,
    MOUSSE_5      = 324,
    MOUSSE_6      = 325,
    MOUSSE_SCROLL = 326,

    END_OF_MOUSE = 380,
}


export const enum GameEventModifier
{
    NONE    = 0,
    SHIFT   = 1 << 0,
    CONTROL = 1 << 1,
    ALT     = 1 << 2,
    OPTION  = 1 << 2, // On MacOS
    META    = 1 << 3,
}


export interface GameEvent
{
    type     : GameEventType;
    key      : GameEventKey;
    isPressed: boolean;
    modifier : GameEventModifier;
    data     : any;
}


let _modifier: GameEventModifier = GameEventModifier.NONE;
export let _events: GameEvent[] = []
export let mouseX : number      = 0;
export let mouseY : number      = 0;
let _copyCutPasteModifier = GameEventModifier.CONTROL;


////////////////////////////////////////////////////////////
export async function event_init()
{
    if (platform_get() & Platform.APPLE)
        _copyCutPasteModifier = GameEventModifier.META;


    function mousse_button(isPressed: boolean, browserEvent: MouseEvent)
    {
        browserEvent.preventDefault();

        let event: GameEvent = {
                                    type     : GameEventType.NONE,
                                    key      : GameEventKey.NONE,
                                    isPressed: isPressed,
                                    modifier : _modifier,
                                    data     : null
                               };

        if (browserEvent.button === 0)
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.MOUSSE_LEFT;
        }
        else if (browserEvent.button === 1)
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.MOUSSE_MIDDLE;
        }
        else if (browserEvent.button === 2)
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.MOUSSE_RIGHT;
        }
        else if (browserEvent.button === 3)
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.MOUSSE_4;
        }
        else if (browserEvent.button === 4)
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.MOUSSE_5;
        }
        else if (browserEvent.button === 5)
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.MOUSSE_6;
        }

        if (event.type !== GameEventType.NONE)
            _events.push(event)
    }


    function mousse_scroll(browserEvent: WheelEvent)
    {
        browserEvent.preventDefault();

        let event: GameEvent = {
                                    type     : GameEventType.KEY,
                                    key      : GameEventKey.MOUSSE_SCROLL,
                                    isPressed: true,
                                    modifier : _modifier,
                                    data     : {x: browserEvent.deltaX, y: browserEvent.deltaY} // on macOS at least
                               };
        _events.push(event);
    }


    function keyboard_button(isPressed: boolean, browserEvent: KeyboardEvent)
    {
        browserEvent.preventDefault();

        let event: GameEvent = {
                                    type     : GameEventType.NONE,
                                    key      : GameEventKey.NONE,
                                    isPressed: isPressed,
                                    modifier : GameEventModifier.NONE,
                                    data     : null
                               };

        let key = browserEvent.key;

        if (key === 'ArrowLeft')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ARROW_LEFT;
        }
        else if (key === 'ArrowUp')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ARROW_UP;
        }
        else if (key === 'ArrowRight')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ARROW_RIGHT;
        }
        else if (key === 'ArrowDown')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ARROW_DOWN;
        }
        else if (key === 'Tab')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.TAB;
        }
        else if (key === 'Enter')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ENTER;
        }
        else if (key === 'End')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.END;
        }
        else if (key === 'Home')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.HOME;
        }
        else if (key === 'PageDown')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.PAGE_DOWN;
        }
        else if (key === 'PageUp')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.PAGE_UP;
        }
        else if (key === 'Backspace')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.BACKSPACE;
        }
        else if (key === 'Delete')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.DELETE;
        }
        else if (key === 'Escape')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ESCAPE;
        }
        else if (key === 'Insert')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.INSERT;
        }
        else if (key === 'Shift')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.SHIFT;

            if (isPressed) _modifier |=  GameEventModifier.SHIFT;
            else           _modifier &= ~GameEventModifier.SHIFT;
        }
        else if (key === 'CapsLock')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.CAPS_LOCK;
        }
        else if (browserEvent.code === 'ControlLeft')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.CONTROL;

            if (isPressed) _modifier |=  GameEventModifier.CONTROL;
            else           _modifier &= ~GameEventModifier.CONTROL;
        }
        else if (browserEvent.code === 'ControlRight')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.RIGHT_CONTROL;
        }
        else if (key === 'Alt')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ALT;

            if (isPressed) _modifier |=  GameEventModifier.ALT;
            else           _modifier &= ~GameEventModifier.ALT;
        }
        else if (key === 'AltGraph')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ALT_GR;
        }
        else if (key === 'Meta')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.META;

            if (isPressed) _modifier |=  GameEventModifier.META;
            else           _modifier &= ~GameEventModifier.META;
        }


        else if (key === 'F1')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F1;
        }
        else if (key === 'F2')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F2;
        }
        else if (key === 'F3')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F3;
        }
        else if (key === 'F5')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F5;
        }
        else if (key === 'F6')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F6;
        }
        else if (key === 'F7')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F7;
        }
        else if (key === 'F8')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F8;
        }
        else if (key === 'F9')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F9;
        }
        else if (key === 'F10')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F10;
        }
        else if (key === 'F11')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F11;
        }
        else if (key === 'F12')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F12;
        }
        else if (key)
        {
            let isCombo    = false;
            let unicodeKey = key.charCodeAt(0);

            if (_modifier & _copyCutPasteModifier)
            {
                if (unicodeKey === GameEventKey._Z || unicodeKey === GameEventKey._z)
                {
                    isCombo = true;
                    event.type = GameEventType.KEY;
                    event.key  = GameEventKey.UNDO;
                    if (_modifier & GameEventModifier.SHIFT)
                        event.key = GameEventKey.REDO;
                }

                else if (unicodeKey === GameEventKey._A || unicodeKey === GameEventKey._a)
                {
                    isCombo = true;
                    event.type = GameEventType.KEY;
                    event.key  = GameEventKey.SELECT_ALL;
                }

                else if (unicodeKey === GameEventKey._X || unicodeKey === GameEventKey._x)
                {
                    isCombo = true;
                    event.type = GameEventType.KEY;
                    event.key  = GameEventKey.CUT;
                }

                else if (unicodeKey === GameEventKey._C || unicodeKey === GameEventKey._c)
                {
                    isCombo = true;
                    event.type = GameEventType.KEY;
                    event.key  = GameEventKey.COPY;
                }

                else if (unicodeKey === GameEventKey._V || unicodeKey === GameEventKey._v)
                {
                    navigator.clipboard.readText().then(
                        (value: string) => {
                                                        event.type = GameEventType.KEY;
                                                        event.key  = GameEventKey.PASTE;
                                                        event.data = value;
                                                        _events.push(event);
                                                    }
                        );
                    isCombo = true;
                }
            }

            if (isCombo === false)
            {
                console.log("key", key);
                event.type = GameEventType.KEY;
                event.key  = key.charCodeAt(0);
            }
        }

        event.modifier = _modifier;

        if (event.type !== GameEventType.NONE)
            _events.push(event)
    }

    document.addEventListener('mousedown', ev => mousse_button(true, ev));
    document.addEventListener('mouseup'  , ev => mousse_button(false, ev));
    _canvas.addEventListener('mousemove' , ev => {mouseX = ev.clientX; mouseY = ev.clientY;});
    _canvas.addEventListener('mouseleave', ev => {mouseX = ev.clientX; mouseY = ev.clientY;});
    document.addEventListener('keydown'  , ev => keyboard_button(true, ev));
    document.addEventListener('keyup'    , ev => keyboard_button(false, ev));
    document.addEventListener('wheel'    , ev => mousse_scroll(ev), { passive: false });
}



////////////////////////////////////////////////////////////
export function event_get_frame_event(): GameEvent[]
{
    let frameEvents          : GameEvent[] = [];
    let countOfProcessedEvent: number      = 0;

    for (let it of _events)
    {
        if (it.type == GameEventType.INTERNAL_TEXTURE_LOADED)
        {
            countOfProcessedEvent += 1;

            let textureCreationData = it.data as TextureCreationEvent;
            let image               = textureCreationData.image;
            let texture             = textureCreationData.texture;

            // @CleanUp (JGoupy):
            // Create separate and good texture system ......
            let glTexture = _gl.createTexture();
            if (!glTexture)
            {
                console.error(`Cannot allocate memory for texture [${texture.url}]`);
                continue;
            }

            let minFilter: number = _gl.LINEAR_MIPMAP_LINEAR;
            let magFilter: number = _gl.LINEAR;
            if (texture.interpolation === TextureInterpolation.NEAREST)
            {
                minFilter = _gl.NEAREST_MIPMAP_NEAREST;
                // minFilter = _gl.NEAREST;
                magFilter = _gl.NEAREST;
            }

            _gl.activeTexture(_gl.TEXTURE0);
            _gl.bindTexture(_gl.TEXTURE_2D, glTexture);
            _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, image);
            _gl.generateMipmap(_gl.TEXTURE_2D);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, minFilter);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, magFilter);
            _gl.bindTexture(_gl.TEXTURE_2D, null);

            texture.glTexture = glTexture;
            texture.width     = image.width;
            texture.height    = image.height;
            console.log(`Texture [${texture.url}] created`, texture);

            renderer_set_texture(null);
        }
        else
        {
            countOfProcessedEvent += 1;

            let newEvent: GameEvent= {
                                        type     : it.type,
                                        key      : it.key,
                                        isPressed: it.isPressed,
                                        modifier : it.modifier,
                                        data     : it.data
                                    };
            frameEvents.push(newEvent);
        }
    }

    _events.length -= countOfProcessedEvent;
    return frameEvents;
}


////////////////////////////////////////////////////////////
export function event_is_keyboard(event: GameEvent): boolean
{
    return (event.type === GameEventType.KEY) &&
           (GameEventKey.START_OF_KEYBOARD <= event.key && event.key < GameEventKey.END_OF_KEYBOARD);
}


////////////////////////////////////////////////////////////
export function event_is_printable(event: GameEvent): boolean
{
    let isClassicPrintable = (32 <= event.key && event.key <= 126);
    let isTab              = event.key === GameEventKey.TAB;

    return (event.type === GameEventType.KEY) &&
           (isClassicPrintable || isTab);
}


////////////////////////////////////////////////////////////
export function event_is_mouse(event: GameEvent): boolean
{
    return (event.type === GameEventType.KEY) &&
           (GameEventKey.END_OF_KEYBOARD <= event.key && event.key < GameEventKey.END_OF_MOUSE);
}


////////////////////////////////////////////////////////////
export function clipboard_push(s: string)
{
    if (navigator.clipboard === undefined)
    {
        console.error("Clipboard not supported");
    }
    else
    {
        try
        {
            navigator.clipboard.writeText(s);
        }
        catch (error)
        {
            console.log(error.toString());
        }
    }
}