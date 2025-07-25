import { event_is_keyboard, event_is_printable, GameEvent, GameEventKey, GameEventType, mouseX, mouseY } from "./event";
import {_defaultFont, font_draw_ascii, MonoFont} from "./font";
import { draw_quad, draw_text, Rect, rect_contain, renderer_scissor_pop, renderer_scissor_push, to_color, to_rect, rect_copy, cursor_set, MouseCursor } from "./renderer";

////////////////////////////////////////////////////////////
// MARK: SYSTEM
////////////////////////////////////////////////////////////
export const enum UiWidgetCapability
{
    NONE      = 0,
    HOVERABLE = 1 << 0,
    GRABBABLE = 1 << 1,
    CLICKABLE = 1 << 2,
    ACTIVABLE = 1 << 3,

    TEXT_SELECTABLE = 1 << 4,
    TEXT_UPDATE     = 1 << 5,
    TEXT            = TEXT_SELECTABLE | TEXT_UPDATE,

    BUTTON_CAPABILITY = HOVERABLE | CLICKABLE,
    TEXT_CAPABILITY   = HOVERABLE | GRABBABLE | CLICKABLE | ACTIVABLE | TEXT_SELECTABLE | TEXT_UPDATE,

    TEXT_KEEP_STATE_AFTER_DE_ACTIVATION = 1 << 6,
}





export const enum UiWidgetState
{
    EMPTY                  = 0,
    CREATED_THIS_FRAME     = 1 << 0,
    ACTIVATED_THIS_FRAME   = 1 << 1,
    DEACTIVATED_THIS_FRAME = 1 << 2,
    HOVERED                = 1 << 3,
    ACTIVE                 = 1 << 4,
    GRABBED                = 1 << 5,
    CLICKED                = 1 << 6,
}


const enum UiWidgetInternalEvent
{
    ACTIVATION    = 1,
    DE_ACTIVATION = 2,

    CLICKED = 4,
    TEXT    = 5,
}


export interface UiWidget
{
    id  : number;
    rect: Rect;
    z   : number;

    capabilities: UiWidgetCapability;
    state       : UiWidgetState;

    text: string;
}


interface UiContext
{
    // radio / checkbox
    isOn: boolean;

    // select
    selected: number[];

    // Text
    font             : MonoFont;
    scale            : number;
    text             : string;
    countOfLine      : number;
    cursorPosition   : number;
    selectionPosition: number;

    // Scroll
    offsetX: number;
    offsetY: number;
}


let _hoveredWidgetZ         : number                 = -1;
let _hoveredWidgetId        : number                 = -1;
let _hoveredWidget          : UiWidget               = null as unknown as UiWidget;
let _isGrabbing             : boolean                = false;
let _activeWidgetId         : number                 = -1;
let _activeWidgetIdLastFrame: number                 = -1;
let _activeWidget           : UiWidget               = null as unknown as UiWidget;
let _currentFrameWidget     : UiWidget[]             = [];
let _contexts               : Map<number, UiContext> = new Map();

let _clickedWidgetId: number = -1;



////////////////////////////////////////////////////////////
function get_context(): UiContext
{
    return {
        isOn             : false,
        selected         : null as unknown as number[],
        font             : _defaultFont,
        scale            : 1,
        text             : null as unknown as string,
        countOfLine      : 0,
        cursorPosition   : -1,
        selectionPosition: -1,
        offsetX          : 0,
        offsetY          : 0,
    };
}













////////////////////////////////////////////////////////////
export function gui_init()
{

}


////////////////////////////////////////////////////////////
export function gui_init_frame()
{
    _hoveredWidgetZ  = -1;
    _hoveredWidgetId = -1;
    _hoveredWidget   = null as unknown as UiWidget;
    _clickedWidgetId = -1;

    let activeWidget = null as unknown as UiWidget;

    for (let it of _currentFrameWidget)
    {
        if (it.id === _activeWidgetId) activeWidget = it;

        if (rect_contain(it.rect, mouseX, mouseY)                                              &&
            it.z > _hoveredWidgetZ                                                             &&
            (it.capabilities & UiWidgetCapability.HOVERABLE) === UiWidgetCapability.HOVERABLE   )
        {
            _hoveredWidgetZ  = it.z;
            _hoveredWidgetId = it.id;
            _hoveredWidget   = it;
        }
    }

    if (activeWidget === null)
    {
        _activeWidget   = null as unknown as UiWidget;
        _activeWidgetId = -1;
    }
}



////////////////////////////////////////////////////////////
export function gui_process_event(events: GameEvent[]): GameEvent[]
{
    let unProcessedEvents: GameEvent[] = [];

    for (let event of events)
    {
        let hasEventBeenProcessed = false;

        if (event.type === GameEventType.KEY)
        {
            if (event.key === GameEventKey.MOUSSE_LEFT)
            {
                if (event.isPressed)
                {
                    if (_hoveredWidgetId !== _activeWidgetId && _activeWidget !== null)
                    {
                        _widget_proc(_activeWidget, UiWidgetInternalEvent.DE_ACTIVATION, null);
                        _activeWidget   = null as unknown as UiWidget;
                        _activeWidgetId = -1;
                    }

                    if (_hoveredWidget !== null)
                    {
                        if (_hoveredWidgetId !== _activeWidgetId)
                            _widget_proc(_hoveredWidget, UiWidgetInternalEvent.ACTIVATION, null);
                        _widget_proc(_hoveredWidget, UiWidgetInternalEvent.CLICKED, null);
                        _activeWidget   = _hoveredWidget;
                        _activeWidgetId = _hoveredWidgetId;
                        _isGrabbing           = true;
                        hasEventBeenProcessed = true;
                    }
                }
                else
                {
                    _isGrabbing = false;

                    if (_activeWidgetId !== -1 && (_activeWidget.capabilities & UiWidgetCapability.CLICKABLE) === UiWidgetCapability.CLICKABLE)
                    {
                        if (_hoveredWidgetId === _activeWidgetId)
                        {
                            _clickedWidgetId = _hoveredWidgetId;
                        }

                        if ((_activeWidget.capabilities & UiWidgetCapability.ACTIVABLE) === 0)
                        {
                            _widget_proc(_activeWidget, UiWidgetInternalEvent.DE_ACTIVATION, null);
                            _activeWidget   = null as unknown as UiWidget;
                            _activeWidgetId = -1;
                        }
                    }
                }
            }

            if (event_is_keyboard(event) &&
                event.isPressed          &&
                _activeWidgetId !== -1   &&
                (_activeWidget.capabilities & UiWidgetCapability.TEXT)
            )
            {
                hasEventBeenProcessed = _widget_proc(_activeWidget, UiWidgetInternalEvent.TEXT, event);
            }
        }

        if (hasEventBeenProcessed === false)
            unProcessedEvents.push(event);

    }

    return unProcessedEvents;
}




////////////////////////////////////////////////////////////
function _widget_proc(widget: UiWidget, eventType: UiWidgetInternalEvent, event: GameEvent | null): boolean
{
    let hasEventBeenProcessed = false;

    if (widget.capabilities & UiWidgetCapability.TEXT)
    {
        let context = _contexts.get(widget.id);

        if (context === undefined)
        {
            console.error(`Text input id [${widget.id}] does not have a context`);
            return false;
        }

        let font = context.font;
        let text = context.text;

        if (eventType === UiWidgetInternalEvent.ACTIVATION)
        {
            console.log("Text ACTIVATION");
            // @Incomplete:
            //     Add option to be set at the start or at the end
            if ((widget.capabilities & UiWidgetCapability.TEXT_KEEP_STATE_AFTER_DE_ACTIVATION) === 0)
            {
                context.cursorPosition    = text.length;
                context.selectionPosition = -1;
            }

            hasEventBeenProcessed = true;
        }

        else if (eventType === UiWidgetInternalEvent.CLICKED)
        {
            console.log("Text CLICKED");
            let localMouseX = mouseX - (widget.rect.x + context.offsetX);
            let localMouseY = mouseY - (widget.rect.y + context.offsetY);
            context.cursorPosition = _find_cursor_position(text, font, context.scale, localMouseX, localMouseY);
            context.selectionPosition = -1;
            hasEventBeenProcessed = true;
        }

        else if (eventType === UiWidgetInternalEvent.DE_ACTIVATION)
        {
            console.log("Text DE_ACTIVATION");
            if ((widget.capabilities & UiWidgetCapability.TEXT_KEEP_STATE_AFTER_DE_ACTIVATION) === 0)
            {
                context.cursorPosition    = -1;
                context.selectionPosition = -1;
            }
        }

        else if (eventType === UiWidgetInternalEvent.TEXT)
        {
            console.log("Text TEXT");
            if (event === null)
            {
                console.error(`Text input id [${widget.id}] cannot process a null TEXT event`);
                return false;
            }

            if (event.isPressed)
            {
                if (event.key === GameEventKey.ARROW_LEFT)
                {
                    context.cursorPosition -= 1;
                    hasEventBeenProcessed = true;
                }

                else if (event.key === GameEventKey.ARROW_RIGHT)
                {
                    context.cursorPosition += 1;
                    hasEventBeenProcessed = true;
                }

                else if (event.key === GameEventKey.BACKSPACE)
                {
                    if (context.cursorPosition > 0)
                    {
                        context.text = context.text.slice(0, context.cursorPosition-1) + context.text.slice(context.cursorPosition);
                        context.cursorPosition -= 1;
                    }

                    hasEventBeenProcessed = true;
                }

                else if (event_is_printable(event))
                {
                    if (context.cursorPosition >= 0)
                    {
                        context.text = context.text.slice(0, context.cursorPosition) + String.fromCharCode(event.key) + context.text.slice(context.cursorPosition);
                        context.cursorPosition += 1;
                    }

                    hasEventBeenProcessed = true;
                }

                else if (event.key === GameEventKey.ENTER)
                {
                    if (context.cursorPosition >= 0)
                    {
                        context.text = context.text.slice(0, context.cursorPosition) + "\n" + context.text.slice(context.cursorPosition);
                        context.cursorPosition += 1;
                    }

                    hasEventBeenProcessed = true;
                }

            }
        }

        if (hasEventBeenProcessed)
        {
            // if (context.cursorPosition < 0)                   context.cursorPosition = 0;
            // if (context.cursorPosition > context.text.length) context.cursorPosition = context.text.length;

            // let cursorX = context.offsetX  + font.width * context.scale * context.cursorPosition;
            // let offsetX = context.offsetX;

            // if (cursorX < 0)                 offsetX -= cursorX;
            // if (cursorX > widget.rect.width) offsetX -= (cursorX - widget.rect.width) + context.scale;

            // context.offsetX = offsetX;
        }
    }



    return hasEventBeenProcessed;
}


////////////////////////////////////////////////////////////
export function gui_prepare_new_frame()
{
    _activeWidgetIdLastFrame = _activeWidgetId;
    _currentFrameWidget.splice(0, _currentFrameWidget.length);
}













////////////////////////////////////////////////////////////
// MARK: WIDGET ID
////////////////////////////////////////////////////////////
function _caller_info(): string
{
    const err = new Error();
    if (!err.stack) return "";

    const stackLines = err.stack.split('\n');
    const callerLine = stackLines[2].trim();

    return callerLine;
}


////////////////////////////////////////////////////////////
function _hash_string(str: string): number
{
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
  }
  return hash >>> 0;
}


////////////////////////////////////////////////////////////
export function widget_id(i: number = 0): number
{
  const callerLocation = _caller_info();
  const seed = `${callerLocation}#${i}`;
  return _hash_string(seed);
}


////////////////////////////////////////////////////////////
export function widget_component_id(widgetId: number, i: number = 0): number
{
  const seed = `${widgetId}#${i}`;
  return _hash_string(seed);
}







////////////////////////////////////////////////////////////
// MARK: WIDGET HELPER
////////////////////////////////////////////////////////////
export function widget_context_of(widget: UiWidget): UiContext
{
    let context = _contexts.get(widget.id);
    if (context === undefined) return get_context();
    return context;
}


////////////////////////////////////////////////////////////
export function widget_context_set_text(context: UiContext, s: string)
{
    context.text        = s;
    context.countOfLine = 1;

    for(let i=0; i < s.length; i+=1)
        if (s[i] === "\n") context.countOfLine += 1;
}


////////////////////////////////////////////////////////////
export function widget_deactivate(widgetId: number)
{
    if (_activeWidgetId === widgetId)
    {
        _widget_proc(_activeWidget, UiWidgetInternalEvent.DE_ACTIVATION, null);
        _activeWidget   = null as unknown as UiWidget;
        _activeWidgetId = -1;
    }
}


////////////////////////////////////////////////////////////
export function widget_activate(widget: UiWidget)
{
    if (_activeWidgetId !== widget.id)
    {
        if (_activeWidgetId !== -1)
            _widget_proc(_activeWidget, UiWidgetInternalEvent.DE_ACTIVATION, null);

        _activeWidget   = widget;
        _activeWidgetId = widget.id;
        _widget_proc(_activeWidget, UiWidgetInternalEvent.ACTIVATION, null);
    }
}















////////////////////////////////////////////////////////////
// MARK: WIDGET LOGIC
////////////////////////////////////////////////////////////
export function gui_rect(id: number, rect: Rect, z: number, capabilities: UiWidgetCapability)
{
    let hasBeenCreatedThisFrame  : boolean = false;
    let doesThisWidgetNeedContext: boolean = false;

    let widget: UiWidget =
    {
        id  : id,
        rect: rect_copy(rect),
        z   : z,

        capabilities: capabilities,
        state       : 0,

        text: null as unknown as string
    };


    if (capabilities & UiWidgetCapability.TEXT)
        doesThisWidgetNeedContext = true;


    if (doesThisWidgetNeedContext)
    {
        if (_contexts.has(id) === false)
        {
            let context = get_context();
            _contexts.set(id, context);
            hasBeenCreatedThisFrame = true;
        }
        else
        {
            let context = _contexts.get(id) as UiContext;
            widget.text = context.text;
        }
    }

    if (widget.id === _activeWidgetId)  widget.state |= UiWidgetState.GRABBED;
    if (widget.id === _hoveredWidgetId) widget.state |= UiWidgetState.HOVERED;
    if (widget.id === _clickedWidgetId) widget.state |= UiWidgetState.CLICKED;
    if (hasBeenCreatedThisFrame)        widget.state |= UiWidgetState.CREATED_THIS_FRAME;

    if (widget.id === _activeWidgetIdLastFrame && widget.id !== _activeWidgetId) widget.state |= UiWidgetState.DEACTIVATED_THIS_FRAME;
    if (widget.id !== _activeWidgetIdLastFrame && widget.id === _activeWidgetId) widget.state |= UiWidgetState.ACTIVATED_THIS_FRAME;

    if (widget.state & UiWidgetState.HOVERED)
    {
        if (capabilities & UiWidgetCapability.CLICKABLE)
        {
            cursor_set(MouseCursor.POINTER);
        }
        if (capabilities & UiWidgetCapability.TEXT)
        {
            cursor_set(MouseCursor.TEXT);
        }
    }

    if (_isGrabbing && (widget.capabilities & UiWidgetCapability.GRABBABLE))
    {
    }

    _currentFrameWidget.push(widget);

    return widget;
}




////////////////////////////////////////////////////////////
// MARK: TEXT
////////////////////////////////////////////////////////////
function _find_cursor_position(s: string, font: MonoFont, scale: number, x: number, y: number): number
{
    let cursorPosition = -1;
    let glyphWidth     = font.width  * scale;
    let lineHeight     = font.height * scale;
    let cursorX        = Math.round(x / glyphWidth - 0.2);
    let cursorY        = Math.floor(y / lineHeight);
    let startOfLine    = 0;
    let endOfLine      = 0;
    let lineNumber     = 0;

    while (endOfLine !== -1)
    {
        endOfLine = s.indexOf("\n", startOfLine);

        if (lineNumber === cursorY)
        {
            if (endOfLine === -1)
                endOfLine = s.length;

            let line = s.substring(startOfLine, endOfLine);
            let cursorOffset = cursorX;
            if (cursorOffset > line.length) cursorOffset = line.length;
            cursorPosition = startOfLine + cursorOffset;

            break;
        }

        startOfLine = endOfLine + 1;
        lineNumber += 1;
    }

    if (cursorPosition === -1) cursorPosition = s.length;
    return cursorPosition;
}


////////////////////////////////////////////////////////////
function _find_next_cursor_position(s: string, cursorPosition: number): number
{


}








export const enum GuiTextEditorOption
{
    NONE             = 0,
    SHOW_LINE_NUMBER = 1 << 0,
}


export function gui_draw_text_editor(widget: UiWidget, option: GuiTextEditorOption =GuiTextEditorOption.NONE)
{
    let context               = widget_context_of(widget);
    let lines                 = widget.text.split("\n");
    let x                     = widget.rect.x;
    let y                     = widget.rect.y;
    let font                  = _defaultFont;
    let scale                 = context.scale;
    let lineHeight            = scale * font.height;
    let accumulatedTextLength = 0

    for (let i=0; i < lines.length ; i+=1)
    {
        let line = lines[i];
        let j    = 0;
        for (; j < line.length ;j+=1)
        {
            font_draw_ascii(x, y, widget.z + 1, font, scale, line[j]);

            if (accumulatedTextLength === context.cursorPosition)
            {
                let cursorRect = to_rect(x, y, scale, lineHeight);
                draw_quad(cursorRect, widget.z + 2, to_color(1, 0, 0, 1));
            }

            accumulatedTextLength += 1;
            x += font.width * scale;
        }

        if (accumulatedTextLength === context.cursorPosition)
        {
            let cursorRect = to_rect(x, y, scale, lineHeight);
            draw_quad(cursorRect, widget.z + 2, to_color(1, 0, 0, 1));
        }

        accumulatedTextLength += 1;
        y += lineHeight;
        x = widget.rect.x;
    }
}










////////////////////////////////////////////////////////////
export function gui_text_input(id: number, rect: Rect, z: number, s: string)
{
    let hasBeenCreatedThisFrame: boolean   = false;
    let context                : UiContext = null as unknown as UiContext;

    if (_contexts.has(id) === false)
    {
        context      = get_context();
        context.text  = s;
        context.scale = 4;
        _contexts.set(id, context);
        hasBeenCreatedThisFrame = true;
    }
    else
    {
        context = _contexts.get(id) as UiContext;
    }

    let widget: UiWidget =
    {
        id  : id,
        rect: rect,
        z   : z,

        capabilities: UiWidgetCapability.HOVERABLE | UiWidgetCapability.CLICKABLE | UiWidgetCapability.ACTIVABLE | UiWidgetCapability.TEXT,
        state       : 0,

        text: context.text,
    };

    if (widget.id === _activeWidgetId)  widget.state |= UiWidgetState.GRABBED;
    if (widget.id === _hoveredWidgetId) widget.state |= UiWidgetState.HOVERED;
    if (widget.id === _clickedWidgetId) widget.state |= UiWidgetState.CLICKED;
    if (hasBeenCreatedThisFrame)        widget.state |= UiWidgetState.CREATED_THIS_FRAME;

    if (widget.id === _activeWidgetIdLastFrame && widget.id !== _activeWidgetId) widget.state |= UiWidgetState.DEACTIVATED_THIS_FRAME;
    if (widget.id !== _activeWidgetIdLastFrame && widget.id === _activeWidgetId) widget.state |= UiWidgetState.ACTIVATED_THIS_FRAME;

    _currentFrameWidget.push(widget);

    return widget;
}



////////////////////////////////////////////////////////////
export function gui_text_input_draw(widget: UiWidget)
{
    let context = widget_context_of(widget);

    let x     = widget.rect.x + context.offsetX;
    let y     = widget.rect.y;
    let z     = widget.z;
    let text  = widget.text;
    let scale = context.scale;

    renderer_scissor_push(widget.rect);
    draw_quad(widget.rect, z, to_color(0, 0, 0, 1));


    for (let i=0; i < text.length ;i+=1)
    {
        font_draw_ascii(x, y, z+1, _defaultFont, scale, text[i]);

        if (i === context.cursorPosition)
        {
            let cursorRect = to_rect(x, y, scale, scale*10);
            draw_quad(cursorRect, z+2, to_color(1, 0, 0, 1));
        }

        x += scale*6;
    }

    if (context.cursorPosition >= text.length)
    {
        let cursorRect = to_rect(x, y, scale, scale*10);
        draw_quad(cursorRect, z+2, to_color(1, 0, 0, 1));
    }

    renderer_scissor_pop();
}