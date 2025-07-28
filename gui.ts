import { clipboard_push, EVENT_COPY_PASTE_KEY, event_is_keyboard, event_is_printable, GameEvent, GameEventKey, GameEventModifier, GameEventType, mouseX, mouseY } from "./event";
import { _defaultFont, font_draw_ascii, MonoFont } from "./font";
import {_nowUs} from "./logic";
import { draw_quad, Rect, rect_contain, scissor_pop, scissor_push, to_color, to_rect, rect_copy, cursor_set, MouseCursor } from "./renderer";
import { Rewinder, rewinder_add_mutation, rewinder_get, rewinder_pop_mutation, rewinder_redo_mutation, TextMutation } from "./rewind";
import { char_is_identifier, char_is_space, string_count } from "./string";

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

    SCROLLABLE = 1 << 6,

    BUTTON_CAPABILITY = HOVERABLE | CLICKABLE,
    TEXT_CAPABILITY   = HOVERABLE | GRABBABLE | CLICKABLE | ACTIVABLE | TEXT_SELECTABLE | TEXT_UPDATE | SCROLLABLE,

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

    DELTA_MOUSE = 3,
    SCROLL      = 4,
    UN_GRABBED  = 5,
    CLICKED     = 6,
    TEXT        = 7,
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
    // Text
    font             : MonoFont;
    scale            : number;
    text             : string;
    countOfLine      : number;
    cursorPosition   : number;
    selectionPosition: number;

    // Scroll
    offsetX    : number;
    offsetY    : number;
    isScrolling: boolean;

    // temp
    rewinder: Rewinder;
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

let _lastInteractionTimeUs: number = 0;
let _clickedWidgetId      : number = -1;



////////////////////////////////////////////////////////////
function get_context(): UiContext
{
    return {
        font             : _defaultFont,
        scale            : 1,
        text             : null as unknown as string,
        countOfLine      : 0,
        cursorPosition   : -1,
        selectionPosition: -1,
        offsetX          : 0,
        offsetY          : 0,
        isScrolling      : false,
        rewinder         : rewinder_get()
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
                        _widget_proc(_hoveredWidget, UiWidgetInternalEvent.CLICKED, event);
                        _activeWidget          = _hoveredWidget;
                        _activeWidgetId        = _hoveredWidgetId;
                        _isGrabbing            = true;
                        hasEventBeenProcessed  = true;
                        _lastInteractionTimeUs = _nowUs;
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

                        if (_activeWidget.capabilities & UiWidgetCapability.GRABBABLE)
                        {
                            _widget_proc(_activeWidget, UiWidgetInternalEvent.UN_GRABBED, null);
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

            if (event.key === GameEventKey.MOUSSE_SCROLL_UP || event.key === GameEventKey.MOUSSE_SCROLL_DOWN)
            {
                if (_hoveredWidgetId !== -1)
                {
                    if (_hoveredWidget.capabilities & UiWidgetCapability.SCROLLABLE)
                    {
                        hasEventBeenProcessed = _widget_proc(_hoveredWidget, UiWidgetInternalEvent.SCROLL, event);
                    }
                }
            }



            if (event_is_keyboard(event) &&
                event.isPressed          &&
                _activeWidgetId !== -1   &&
                (_activeWidget.capabilities & UiWidgetCapability.TEXT)
            )
            {
                _lastInteractionTimeUs = _nowUs;
                hasEventBeenProcessed = _widget_proc(_activeWidget, UiWidgetInternalEvent.TEXT, event);
            }
        }

        if (hasEventBeenProcessed === false)
            unProcessedEvents.push(event);

    }

    if (_isGrabbing            &&
        _activeWidget !== null &&
        (_activeWidget.capabilities & UiWidgetCapability.GRABBABLE))
    {
        _lastInteractionTimeUs = _nowUs;
        _widget_proc(_activeWidget, UiWidgetInternalEvent.DELTA_MOUSE, null);
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

         // Can only be used for read
        let font              = context.font;
        let text              = context.text;
        let cursorPosition    = context.cursorPosition;
        let selectionPosition = context.selectionPosition;
        let scale             = context.scale;
        let rect              = widget.rect;
        let charWidth         = font.width  * scale;
        let charHeight        = font.height * scale;

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
            console.assert(event !== null);

            // console.log("Text CLICKED");
            let localMouseX = mouseX - (widget.rect.x + context.offsetX);
            let localMouseY = mouseY - (widget.rect.y + context.offsetY);

            // @ts-ignore
            if ((event.modifier & GameEventModifier.SHIFT) === GameEventModifier.SHIFT &&
                context.cursorPosition !== -1)
            {
                if (context.selectionPosition === -1)
                    context.selectionPosition = context.cursorPosition;
                context.cursorPosition = _find_cursor_position(text, font, scale, localMouseX, localMouseY);
            }
            else
            {
                context.cursorPosition    = _find_cursor_position(text, font, scale, localMouseX, localMouseY);
                context.selectionPosition = context.cursorPosition;
            }

            context.isScrolling   = false;
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

        else if (eventType === UiWidgetInternalEvent.DELTA_MOUSE)
        {
            let localMouseX = mouseX - (rect.x + context.offsetX);
            let localMouseY = mouseY - (rect.y + context.offsetY);
            context.cursorPosition = _find_cursor_position(text, font, scale, localMouseX, localMouseY);
            hasEventBeenProcessed = true;
        }

        else if (eventType === UiWidgetInternalEvent.SCROLL)
        {
            // @ts-ignore
            if (event.modifier & GameEventModifier.CONTROL)
            {
                // @ts-ignore
                if (event.key === GameEventKey.MOUSSE_SCROLL_UP)
                {
                    if (scale < 5) context.scale += 1;
                }
                // @ts-ignore
                else if (event.key === GameEventKey.MOUSSE_SCROLL_DOWN)
                {
                    if (scale > 1) context.scale -= 1;
                }

                scale      = context.scale;
                charWidth  = font.width  * scale;
                charHeight = font.height * scale;
            }
            else
            {
                context.isScrolling = true;

                // @ts-ignore
                if (event.key === GameEventKey.MOUSSE_SCROLL_UP)
                {
                    context.offsetY += charHeight;
                    if (context.offsetY > 0) context.offsetY = 0;
                }
                // @ts-ignore
                else if (event.key === GameEventKey.MOUSSE_SCROLL_DOWN)
                {
                    let maxHeight = context.countOfLine * charHeight - rect.height;
                    if (maxHeight < 0) maxHeight = 0;

                    context.offsetY -= charHeight;
                    if (context.offsetY < -maxHeight) context.offsetY = -maxHeight;
                }
            }

            hasEventBeenProcessed = true;
        }

        else if (eventType === UiWidgetInternalEvent.UN_GRABBED)
        {
            if (cursorPosition === context.selectionPosition) context.selectionPosition = -1;
        }

        else if (eventType === UiWidgetInternalEvent.TEXT)
        {
            // console.log("Text TEXT");
            if (event === null)
            {
                console.error(`Text input id [${widget.id}] cannot process a null TEXT event`);
                return false;
            }

            if (event.isPressed)
            {
                context.isScrolling = false;

                if (event.key === GameEventKey.ARROW_LEFT)
                {
                    if (event.modifier & GameEventModifier.SHIFT)
                    {
                        if (context.selectionPosition === -1)
                        {
                            context.selectionPosition = cursorPosition;
                        }

                        if (event.modifier & GameEventModifier.CONTROL)
                            context.cursorPosition = _text_get_previous_word(text, cursorPosition);
                        else
                            context.cursorPosition -= 1;
                    }
                    else
                    {
                        if (context.selectionPosition !== -1)
                        {
                            context.cursorPosition = Math.min(context.cursorPosition, context.selectionPosition);
                            context.selectionPosition = -1;

                            if (event.modifier & GameEventModifier.CONTROL)
                                context.cursorPosition = _text_get_previous_word(text, context.cursorPosition);
                        }
                        else
                        {
                            if (event.modifier & GameEventModifier.CONTROL)
                                context.cursorPosition = _text_get_previous_word(text, cursorPosition);
                            else
                                context.cursorPosition -= 1;
                        }
                    }

                    if (context.cursorPosition < 0) context.cursorPosition = 0;

                    hasEventBeenProcessed = true;
                }

                else if (event.key === GameEventKey.ARROW_RIGHT)
                {
                    if (event.modifier & GameEventModifier.SHIFT)
                    {
                        if (context.selectionPosition === -1)
                        {
                            context.selectionPosition = context.cursorPosition;
                        }

                        if (event.modifier & GameEventModifier.CONTROL)
                            context.cursorPosition = _text_get_next_word(text, cursorPosition);
                        else
                            context.cursorPosition += 1;
                    }
                    else
                    {
                        if (context.selectionPosition !== -1)
                        {
                            context.cursorPosition = Math.max(context.cursorPosition, context.selectionPosition);
                            context.selectionPosition = -1;

                            if (event.modifier & GameEventModifier.CONTROL)
                                context.cursorPosition = _text_get_next_word(text, context.cursorPosition);
                        }
                        else
                        {
                            if (event.modifier & GameEventModifier.CONTROL)
                                context.cursorPosition = _text_get_next_word(text, cursorPosition);
                            else
                                context.cursorPosition += 1;
                        }
                    }

                    if (context.cursorPosition > context.text.length) context.cursorPosition = context.text.length;

                    hasEventBeenProcessed = true;
                }

                else if (event.key === GameEventKey.ARROW_DOWN)
                {
                    let [startOfLine, endOfLine] = _text_get_line_containing_cursor(text, context.cursorPosition);
                    let offsetFromStartOfLine    = context.cursorPosition - startOfLine;
                    let cursorPositionOnNextLine = _text_get_cursor_or_end_of_line(text, endOfLine+1, offsetFromStartOfLine);

                    if (event.modifier & GameEventModifier.SHIFT)
                    {
                        if (context.selectionPosition === -1)
                        {
                            context.selectionPosition = context.cursorPosition;
                        }

                        context.cursorPosition = cursorPositionOnNextLine;
                    }
                    else
                    {
                        context.cursorPosition    = cursorPositionOnNextLine;
                        context.selectionPosition = -1;
                    }

                    if (context.cursorPosition > context.text.length) context.cursorPosition = context.text.length;

                    hasEventBeenProcessed = true;
                }

                else if (event.key === GameEventKey.ARROW_UP)
                {
                    let [startOfLine, endOfLine] = _text_get_line_containing_cursor(text, context.cursorPosition);
                    let offsetFromStartOfLine    = context.cursorPosition - startOfLine;
                    let startOfPreviousLine      = 0;
                    let cursorPositionOnNextLine = 0;

                    if (startOfLine !== 0)
                    {
                        [startOfPreviousLine, endOfLine] = _text_get_line_containing_cursor(text, startOfLine - 1);
                        cursorPositionOnNextLine = _text_get_cursor_or_end_of_line(text, startOfPreviousLine, offsetFromStartOfLine);
                    }

                    if (event.modifier & GameEventModifier.SHIFT)
                    {
                        if (context.selectionPosition === -1)
                        {
                            context.selectionPosition = context.cursorPosition;
                        }

                        context.cursorPosition = cursorPositionOnNextLine;
                    }
                    else
                    {
                        context.cursorPosition    = cursorPositionOnNextLine;
                        context.selectionPosition = -1;
                    }

                    if (context.cursorPosition > context.text.length) context.cursorPosition = context.text.length;

                    hasEventBeenProcessed = true;
                }

                else if (event.key === GameEventKey.BACKSPACE || event.key === GameEventKey.DELETE)
                {
                    let startOfDeletion = cursorPosition - 1;
                    let endOfDeletion   = cursorPosition;

                    if (event.modifier & GameEventModifier.CONTROL)
                        startOfDeletion = _text_get_previous_word(text, cursorPosition);

                    if (event.key === GameEventKey.DELETE)
                    {
                        startOfDeletion = cursorPosition;
                        endOfDeletion   = cursorPosition + 1;

                        if (event.modifier & GameEventModifier.CONTROL)
                            endOfDeletion = _text_get_next_word(text, cursorPosition);
                    }

                    if (context.selectionPosition !== -1)
                    {
                        startOfDeletion = Math.min(selectionPosition, cursorPosition);
                        endOfDeletion   = Math.max(selectionPosition, cursorPosition);
                    }

                    if (startOfDeletion >= 0 && startOfDeletion < text.length)
                    {
                        _text_push_mutation(context.rewinder, text, startOfDeletion, endOfDeletion, "");
                        context.text = _text_delete_insert(text, startOfDeletion, endOfDeletion, "");
                        context.cursorPosition = startOfDeletion;
                    }

                    context.selectionPosition = -1;
                    hasEventBeenProcessed     = true;
                    context.countOfLine       -= string_count(text, "\n", startOfDeletion, endOfDeletion);
                }

                else if (event.key === GameEventKey.HOME)
                {
                    if (event.modifier & GameEventModifier.SHIFT)
                        if (context.selectionPosition === -1)
                            context.selectionPosition = context.cursorPosition;

                    let [startOfLine, endOfLine] = _text_get_line_containing_cursor(text, cursorPosition);
                    context.cursorPosition = startOfLine;
                    hasEventBeenProcessed  = true;
                }

                else if (event.key === GameEventKey.END)
                {
                    if (event.modifier & GameEventModifier.SHIFT)
                        if (context.selectionPosition === -1)
                            context.selectionPosition = context.cursorPosition;

                    let [startOfLine, endOfLine] = _text_get_line_containing_cursor(text, cursorPosition);
                    context.cursorPosition = endOfLine;
                    hasEventBeenProcessed  = true;
                }

                else if (event_is_printable(event))
                {
                    if ((event.modifier & EVENT_COPY_PASTE_KEY) &&
                         (event.key === GameEventKey._C || event.key === GameEventKey._c))
                    {
                        let startOfCopy = Math.min(context.cursorPosition, context.selectionPosition);
                        let endOfCopy   = Math.max(context.cursorPosition, context.selectionPosition);

                        if (context.selectionPosition === -1 || startOfCopy === endOfCopy)
                        {
                            [startOfCopy, endOfCopy] = _text_get_line_containing_cursor(text, context.cursorPosition);
                        }

                        clipboard_push(text.substring(startOfCopy, endOfCopy));
                    }
                    else if ((event.modifier & EVENT_COPY_PASTE_KEY) &&
                         (event.key === GameEventKey._X || event.key === GameEventKey._x))
                    {
                        let startOfCopy = Math.min(context.cursorPosition, context.selectionPosition);
                        let endOfCopy   = Math.max(context.cursorPosition, context.selectionPosition);

                        if (context.selectionPosition === -1 || startOfCopy === endOfCopy)
                        {
                            [startOfCopy, endOfCopy] = _text_get_line_containing_cursor(text, context.cursorPosition);
                        }

                        let textToCut = text.substring(startOfCopy, endOfCopy)
                        clipboard_push(textToCut);
                        _text_push_mutation(context.rewinder, text, startOfCopy, endOfCopy, "");
                        context.text              = _text_delete_insert(text, startOfCopy, endOfCopy, "");
                        context.cursorPosition    = startOfCopy;
                        context.selectionPosition = -1;

                        context.countOfLine -= string_count(textToCut, "\n");
                    }

                    else if ((event.modifier & EVENT_COPY_PASTE_KEY) &&
                        (event.key === GameEventKey._Z || event.key === GameEventKey._z))
                    {
                        if (event.modifier & GameEventModifier.SHIFT)
                        {
                            let mutation = rewinder_redo_mutation(context.rewinder);
                            if (mutation !== null)
                            {
                                context.text           = _text_delete_insert(text, mutation.cursor,  mutation.cursor + mutation.deletedText.length, mutation.insertedText);
                                context.cursorPosition = mutation.cursor + mutation.insertedText.length;
                            }
                        }
                        else
                        {
                            let mutation = rewinder_pop_mutation(context.rewinder);
                            if (mutation !== null)
                            {

                                context.text           = _text_delete_insert(text, mutation.cursor, mutation.cursor + mutation.insertedText.length, mutation.deletedText);
                                context.cursorPosition = mutation.cursor + mutation.deletedText.length;
                            }
                        }

                        context.selectionPosition = -1;
                        hasEventBeenProcessed     = true;
                    }

                    else
                    {
                        let startOfDeletion = context.cursorPosition;
                        let endOfDeletion   = context.cursorPosition;

                        if (context.selectionPosition !== -1)
                        {
                            startOfDeletion = Math.min(context.selectionPosition, context.cursorPosition);
                            endOfDeletion   = Math.max(context.selectionPosition, context.cursorPosition);
                        }

                        let textToInsert = String.fromCharCode(event.key);
                        if ((event.modifier & EVENT_COPY_PASTE_KEY) &&
                            (event.key === GameEventKey._V || event.key === GameEventKey._v))
                        {
                        }

                        if (event.key === GameEventKey.TAB)
                            textToInsert = "    ";

                        _text_push_mutation(context.rewinder, text, startOfDeletion, endOfDeletion, textToInsert);
                        context.text = _text_delete_insert(text, startOfDeletion, endOfDeletion, textToInsert);
                        context.cursorPosition = startOfDeletion + textToInsert.length;

                        context.selectionPosition = -1;
                        context.countOfLine += string_count(textToInsert, "\n") - string_count(text, "\n", startOfDeletion, endOfDeletion);
                    }

                    hasEventBeenProcessed = true;
                }

                else if (event.key === GameEventKey.ENTER)
                {
                    if (context.cursorPosition >= 0)
                    {
                        _text_push_mutation(context.rewinder, text, context.cursorPosition, context.cursorPosition, "\n");
                        context.text = context.text.slice(0, context.cursorPosition) + "\n" + context.text.slice(context.cursorPosition);
                        context.cursorPosition += 1;
                    }

                    hasEventBeenProcessed = true;
                    context.countOfLine += 1;
                }

            }
        }



        if (hasEventBeenProcessed       &&
            context.cursorPosition >= 0 &&
            context.isScrolling === false)
        {
            let offsetRectInChar: Rect = to_rect(context.offsetX, context.offsetY, rect.width, rect.height);
            offsetRectInChar.x = Math.floor(offsetRectInChar.x / charWidth);
            offsetRectInChar.y = Math.floor(offsetRectInChar.y / charHeight);
            offsetRectInChar.width  = Math.floor(offsetRectInChar.width  / charWidth);
            offsetRectInChar.height = Math.floor(offsetRectInChar.height / charHeight);

            // console.log(offsetRectInChar);

            let startOfCursorLine = context.text.substring(0, context.cursorPosition).lastIndexOf("\n") + 1;

            let cursorX = context.cursorPosition - startOfCursorLine;
            let cursorY = string_count(context.text, "\n", 0, context.cursorPosition);

            // console.log(cursorX, cursorY);

            if ((cursorY + offsetRectInChar.y) >= offsetRectInChar.height) context.offsetY = (offsetRectInChar.height - cursorY - 1) * charHeight;
            if ((cursorY + offsetRectInChar.y) < 0)                        context.offsetY = -cursorY * charHeight;

            if ((cursorX + offsetRectInChar.x) >= offsetRectInChar.width) context.offsetX = (offsetRectInChar.width - cursorX) * charWidth;
            if ((cursorX + offsetRectInChar.x) < 0)                       context.offsetX = -cursorX * charWidth;
        }
    }



    return hasEventBeenProcessed;
}


////////////////////////////////////////////////////////////
export function gui_prepare_new_frame()
{
    _activeWidgetIdLastFrame = _activeWidgetId;
    _currentFrameWidget.length = 0;
}













////////////////////////////////////////////////////////////
// MARK: WIDGET ID
////////////////////////////////////////////////////////////
export function widget_id(lineNumber: number, i: number = 0): number
{
    let hash = 5381;
    hash = ((hash << 5) + hash) + lineNumber;
    hash = ((hash << 5) + hash) + i;
    return hash >>> 0;
}


////////////////////////////////////////////////////////////
export function widget_component_id(widgetId: number, i: number = 0): number
{
    widgetId = ((widgetId << 5) + widgetId) + i;
    return widgetId >>> 0;
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
    context.countOfLine = string_count(context.text, "\n") + 1;
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
    let cursorX        = Math.round(x / glyphWidth + 0.4);
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

            let lineCount    = endOfLine - startOfLine;
            let cursorOffset = cursorX;
            if (cursorOffset > lineCount) cursorOffset = lineCount;
            cursorPosition = startOfLine + cursorOffset;

            break;
        }

        startOfLine = endOfLine + 1;
        lineNumber += 1;
    }

    if (cursorPosition === -1)
    {
            if (y > 0) cursorPosition = s.length;
            else       cursorPosition = 0;
    }
    return cursorPosition;
}


////////////////////////////////////////////////////////////
function _text_delete_insert(s: string, startOfDeletion: number, endOfDeteletion: number, insertion: string): string
{
    return s.slice(0, startOfDeletion) + insertion + s.slice(endOfDeteletion);
}


////////////////////////////////////////////////////////////
function _text_push_mutation(rewinder: Rewinder, s: string, startOfDeletion: number, endOfDeteletion: number, insertion: string)
{
    let mutation: TextMutation =
    {
        cursor      : startOfDeletion,
        deletedText : s.substring(startOfDeletion, endOfDeteletion),
        insertedText: insertion.substring(0)
    };
    rewinder_add_mutation(rewinder, mutation);
}






////////////////////////////////////////////////////////////
function _text_get_line_containing_cursor(s: string, cursorPosition: number): [number, number]
{
    let startOfLine = s.substring(0, cursorPosition).lastIndexOf("\n") + 1;
    let endOfLine   = s.indexOf("\n", cursorPosition);

    if (startOfLine === -1) startOfLine = 0;
    if (endOfLine   === -1) endOfLine   = s.length;

    return [startOfLine, endOfLine];
}


////////////////////////////////////////////////////////////
function _text_get_cursor_or_end_of_line(s: string, startOfLine: number, offset: number): number
{
    let endOfLine = s.indexOf("\n", startOfLine);
    if (endOfLine === -1) endOfLine = s.length;
    let lineCount = endOfLine - startOfLine;
    if (offset > lineCount) offset = lineCount;
    return startOfLine + offset;
}


////////////////////////////////////////////////////////////
function _text_get_previous_word(s: string, cursor: number): number
{
    while (cursor > 0 && char_is_identifier(s, cursor-1) == false)
        cursor -= 1;

    while (cursor > 0 && char_is_identifier(s, cursor-1))
        cursor -= 1;

    return cursor;
}


////////////////////////////////////////////////////////////
function _text_get_next_word(s: string, cursor: number): number
{
    let count = s.length;

    while (cursor < count && char_is_identifier(s, cursor) == false)
        cursor += 1;

    while (cursor < count && char_is_identifier(s, cursor))
        cursor += 1;

    return cursor;
}




export const enum GuiTextEditorOption
{
    NONE             = 0,
    SHOW_LINE_NUMBER = 1 << 0,
}


export function gui_draw_text_editor(widget: UiWidget, option: GuiTextEditorOption =GuiTextEditorOption.NONE)
{
    const TEXT_COLOR       = to_color(0.8, 0.8, 0.8, 1);
    const BACKGROUND_COLOR = to_color(0, 0, 0, 1);
    const SELECTION_COLOR  = to_color(0, 0, 0.6, 1);
    const CURSOR_COLOR     = to_color(1, 0, 0, 1);

    let context                 = widget_context_of(widget);
    let text                    = context.text;
    let count                   = text.length;
    let offsetX                 = context.offsetX;
    let offsetY                 = context.offsetY;
    let rect                    = widget.rect;
    let scale                   = context.scale;
    let startingX               = rect.x + offsetX + scale;
    let x                       = startingX;
    let y                       = rect.y + offsetY;
    let font                    = _defaultFont;
    let glyphWidth              = scale * font.width;
    let lineHeight              = scale * font.height;
    let accumulatedTextLength   = 0
    let cursorPosition          = context.cursorPosition;
    let selectionCursorPosition = context.selectionPosition;
    let shouldShowCursor        = (Math.round((_nowUs - _lastInteractionTimeUs) / 500_000) & 1) === 0;

    let startOfSelection = -1;
    let endOfSelection   = -1;
    let isSelecting      = false;
    if (selectionCursorPosition !== -1)
    {
        startOfSelection = Math.min(selectionCursorPosition, cursorPosition);
        endOfSelection   = Math.max(selectionCursorPosition, cursorPosition);
    }

    scissor_push(rect);

    let startOfLine = 0;
    let endOfLine   = text.indexOf("\n");

    while (startOfLine < count)
    {
        let j = startOfLine;
        for (; j < endOfLine ;j+=1)
        {
            if (accumulatedTextLength === startOfSelection) isSelecting = true;
            if (accumulatedTextLength === endOfSelection)   isSelecting = false;

            if (isSelecting)
                draw_quad(to_rect(x, y, glyphWidth, lineHeight), widget.z + 1, SELECTION_COLOR);

            if (shouldShowCursor && accumulatedTextLength === cursorPosition)
            {
                let cursorRect = to_rect(x-1, y, scale, lineHeight);
                draw_quad(cursorRect, widget.z + 3, CURSOR_COLOR);
            }

            accumulatedTextLength += 1;
            x += glyphWidth;
        }

        if (shouldShowCursor && accumulatedTextLength === cursorPosition)
        {
            let cursorRect = to_rect(x - 1, y, scale, lineHeight);
            draw_quad(cursorRect, widget.z + 2, CURSOR_COLOR);
        }

        if (accumulatedTextLength === startOfSelection) isSelecting = true;
        if (accumulatedTextLength === endOfSelection)   isSelecting = false;

        accumulatedTextLength += 1;
        y += lineHeight;
        x = startingX;

        startOfLine = endOfLine + 1;
        endOfLine   = text.indexOf("\n", startOfLine);
        if (endOfLine === -1) endOfLine = text.length;
    }


    x = startingX;
    y = rect.y + offsetY;
    startOfLine = 0;
    endOfLine   = text.indexOf("\n");

    while (startOfLine < count)
    {
        for (let j = startOfLine; j < endOfLine ;j+=1)
        {
            font_draw_ascii(x, y, widget.z + 2, font, scale, text[j], TEXT_COLOR);
            x += glyphWidth;
        }
        y += lineHeight;
        x = startingX;

        startOfLine = endOfLine + 1;
        endOfLine   = text.indexOf("\n", startOfLine);
        if (endOfLine === -1) endOfLine = text.length;
    }

    scissor_pop();
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

    scissor_push(widget.rect);
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

    scissor_pop();
}