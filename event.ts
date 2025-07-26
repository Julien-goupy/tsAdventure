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

    ARROW_LEFT   = 256,
    ARROW_UP     = 257,
    ARROW_RIGHT  = 258,
    ARROW_DOWN = 259,

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
    MOUSSE_MIDDLE = 321,
    MOUSSE_RIGHT  = 322,
    MOUSSE_4      = 323,
    MOUSSE_5      = 324,
    MOUSSE_6      = 325,

    END_OF_MOUSE = 330,
}

export const enum GameEventModifier
{
    NONE    = 0,
    SHIFT   = 1 << 0,
    CONTROL = 1 << 1,
    ALT     = 1 << 2,
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


////////////////////////////////////////////////////////////
export function event_init()
{
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

        if (browserEvent.key === 'ArrowLeft')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ARROW_LEFT;
        }
        else if (browserEvent.key === 'ArrowUp')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ARROW_UP;
        }
        else if (browserEvent.key === 'ArrowRight')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ARROW_RIGHT;
        }
        else if (browserEvent.key === 'ArrowDown')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ARROW_DOWN;
        }
        else if (browserEvent.key === 'Tab')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.TAB;
        }
        else if (browserEvent.key === 'Enter')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ENTER;
        }
        else if (browserEvent.key === 'End')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.END;
        }
        else if (browserEvent.key === 'Home')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.HOME;
        }
        else if (browserEvent.key === 'PageDown')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.PAGE_DOWN;
        }
        else if (browserEvent.key === 'PageUp')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.PAGE_UP;
        }
        else if (browserEvent.key === 'Backspace')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.BACKSPACE;
        }
        else if (browserEvent.key === 'Delete')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.DELETE;
        }
        else if (browserEvent.key === 'Escape')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ESCAPE;
        }
        else if (browserEvent.key === 'Insert')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.INSERT;
        }
        else if (browserEvent.key === 'Shift')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.SHIFT;

            if (isPressed) _modifier |= GameEventModifier.SHIFT;
            else           _modifier &= ~GameEventModifier.SHIFT;
        }
        else if (browserEvent.key === 'CapsLock')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.CAPS_LOCK;
        }
        else if (browserEvent.code === 'ControlLeft')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.CONTROL;

            if (isPressed) _modifier |= GameEventModifier.CONTROL;
            else           _modifier &= ~GameEventModifier.CONTROL;
        }
        else if (browserEvent.code === 'ControlRight')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.RIGHT_CONTROL;
        }
        else if (browserEvent.key === 'Alt')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ALT;

            if (isPressed) _modifier |= GameEventModifier.ALT;
            else           _modifier &= ~GameEventModifier.ALT;
        }
        else if (browserEvent.key === 'AltGraph')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.ALT_GR;
        }
        else if (browserEvent.key === 'Meta')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.META;

            if (isPressed) _modifier |= GameEventModifier.META;
            else           _modifier &= ~GameEventModifier.META;
        }


        else if (browserEvent.key === 'F1')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F1;
        }
        else if (browserEvent.key === 'F2')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F2;
        }
        else if (browserEvent.key === 'F3')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F3;
        }
        else if (browserEvent.key === 'F5')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F5;
        }
        else if (browserEvent.key === 'F6')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F6;
        }
        else if (browserEvent.key === 'F7')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F7;
        }
        else if (browserEvent.key === 'F8')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F8;
        }
        else if (browserEvent.key === 'F9')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F9;
        }
        else if (browserEvent.key === 'F10')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F10;
        }
        else if (browserEvent.key === 'F11')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F11;
        }
        else if (browserEvent.key === 'F12')
        {
            event.type = GameEventType.KEY;
            event.key  = GameEventKey.F12;
        }
        else if (browserEvent.key)
        {
            console.log("key", browserEvent.key);
            event.type = GameEventType.KEY;
            event.key  = browserEvent.key.charCodeAt(0);
        }






        event.modifier = _modifier;

        if (event.type !== GameEventType.NONE)
            _events.push(event)
    }

    _canvas.addEventListener('mousedown', ev => mousse_button(true, ev));
    _canvas.addEventListener('mouseup'  , ev => mousse_button(false, ev));
    _canvas.addEventListener('mousemove', ev => {mouseX = ev.clientX; mouseY = ev.clientY;});
    document.addEventListener('keydown', ev => keyboard_button(true, ev));
    document.addEventListener('keyup'  , ev => keyboard_button(false, ev));
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
                                        data     : null
                                    };
            frameEvents.push(newEvent);
        }
    }

    _events.splice(0, countOfProcessedEvent);
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
    return (event.type === GameEventType.KEY) &&
           (32 <= event.key && event.key <= 126);
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
};