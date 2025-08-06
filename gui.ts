import { clipboard_push, event_is_keyboard, event_is_printable, GameEvent, GameEventKey, GameEventModifier, GameEventType, mouseX, mouseY } from "./event";
import { _defaultFont, font_draw_ascii, MonoFont } from "./font";
import {_nowUs, Platform, platform_get} from "./logic";
import { draw_quad, Rect, rect_contain, scissor_pop, scissor_push, to_color, to_rect, rect_copy, cursor_set, MouseCursor } from "./renderer";
import { Rewinder, rewinder_add_mutation, rewinder_get, rewinder_pop_mutation, rewinder_redo_mutation, TextMutation } from "./rewind";
import { char_is_identifier, string_to_utf32, string_utf32_count, string_utf32_index_of, string_utf32_last_index_of, StringUtf32, UTF32_NEW_LINE } from "./string";


////////////////////////////////////////////////////////////
// MARK: SYSTEM
////////////////////////////////////////////////////////////
export const enum UiWidgetCapability
{
    NONE         = 0,
    HOVERABLE    = 1 << 0,
    ACTIVABLE    = 1 << 1,
    LEFT_CLICK   = 1 << 2,
    MIDDLE_CLICK = 1 << 3,
    RIGHT_CLICK  = 1 << 4,
    KEYBOARD     = 1 << 5,
    SCROLLABLE_X = 1 << 6,
    SCROLLABLE_Y = 1 << 7,
    SCROLLABLE   = SCROLLABLE_X | SCROLLABLE_Y,

    CLICKED_ON_PRESSED = 1 << 8, // Click is triggered when button is pressed, not released
}


export const enum UiWidgetStateFlag
{
    EMPTY = 0,

    ACTIVE                  = 1 << 0,
    START_ACTIVE_THIS_FRAME = 1 << 1,
    STOP_ACTIVE_THIS_FRAME  = 1 << 2,

    HOVERED                  = 1 << 3,
    START_HOVERED_THIS_FRAME = 1 << 4,
    STOP_HOVERED_THIS_FRAME  = 1 << 5,

    LEFT_MOUSE_PRESSED   = 1 << 6,
    MIDDLE_MOUSE_PRESSED = 1 << 7,
    RIGHT_MOUSE_PRESSED  = 1 << 8,

    LEFT_MOUSE_CLICKED   = 1 << 9,
    MIDDLE_MOUSE_CLICKED = 1 << 10,
    RIGHT_MOUSE_CLICKED  = 1 << 11,

    LEFT_MOUSE_RELEASED   = 1 << 12,
    MIDDLE_MOUSE_RELEASED = 1 << 13,
    RIGHT_MOUSE_RELEASED  = 1 << 14,

    INTERACTING                  = 1 << 15,
    START_INTERACTING_THIS_FRAME = 1 << 16,
    STOP_INTERACTING_THIS_FRAME  = 1 << 17,

    KEYBOARD_KEY_PRESSED = 1 << 18,
}


export interface UiWidgetState
{
    flag                   : UiWidgetStateFlag;
    consecutiveClickCounter: number;
    lastInteractionTimeUs  : number;

    id  : number;
    rect: Rect;
    z   : number;
}


export interface UiWidget
{
    id  : number;
    rect: Rect;
    z   : number;

    capabilities: UiWidgetCapability;
}





let _hoveredWidgetZ          : number   = -1;
let _hoveredWidgetId         : number   = -1;
let _hoveredWidget           : UiWidget = null as unknown as UiWidget;
let _previousHoveredWidgetId: number   = -1;

let _activeWidgetId        : number   = -1;
let _previousActiveWidgetId: number   = -1;
let _nextActiveWidgetId    : number   = -1;
let _activeWidget          : UiWidget = null as unknown as UiWidget;

let _interactingWidgetId        : number = -1;
let _previousInteractingWidgetId: number = -1;

let _lastInteractionTimeUs  : number       =  0;
let _clickedMouseButton     : GameEventKey = GameEventKey.NONE;
let _clickedMouseButtonPressed : boolean      = false;
let _lastClickedTimeUs      : number       =  0;
let _consecutiveClickCounter: number       =  0;



let _currentFrameWidget     : UiWidget[]             = [];



////////////////////////////////////////////////////////////
export function gui_init()
{
    if (platform_get() & Platform.APPLE)
        _textWordNavigation = GameEventModifier.OPTION;
}


////////////////////////////////////////////////////////////
export function gui_process_event(events: GameEvent[]): GameEvent[]
{
    _clickedMouseButton          = GameEventKey.NONE;
    _previousInteractingWidgetId = _interactingWidgetId;

    _previousHoveredWidgetId = _hoveredWidgetId;
    _hoveredWidgetZ          = -1;
    _hoveredWidgetId         = -1;
    _hoveredWidget           = null as unknown as UiWidget;

    _activeWidget           = null as unknown as UiWidget;
    _previousActiveWidgetId = _activeWidgetId;
    _activeWidgetId         = _nextActiveWidgetId;

    for (let it of _currentFrameWidget)
    {
        if (it.id === _activeWidgetId) _activeWidget = it;

        if (rect_contain(it.rect, mouseX, mouseY)                                              &&
            it.z > _hoveredWidgetZ                                                             &&
            (it.capabilities & UiWidgetCapability.HOVERABLE) === UiWidgetCapability.HOVERABLE   )
        {
            _hoveredWidgetZ  = it.z;
            _hoveredWidgetId = it.id;
            _hoveredWidget   = it;
        }
    }

    if (_activeWidget === null)
        _activeWidgetId = -1;





    let hoveredWidgetSupportLeftMouseClick   = (_hoveredWidgetId !== -1) && (_hoveredWidget.capabilities & UiWidgetCapability.LEFT_CLICK);
    let hoveredWidgetSupportMiddleMouseClick = (_hoveredWidgetId !== -1) && (_hoveredWidget.capabilities & UiWidgetCapability.MIDDLE_CLICK);
    let hoveredWidgetSupportRightMouseClick  = (_hoveredWidgetId !== -1) && (_hoveredWidget.capabilities & UiWidgetCapability.RIGHT_CLICK);

    for (let i=events.length-1; i >= 0 ;i-=1)
    {
        let event                 = events[i];
        let hasEventBeenProcessed = false;

        if (event.type === GameEventType.KEY)
        {
            if (event.key === GameEventKey.MOUSSE_LEFT)
            {
                if (event.isPressed)
                {
                    _clickedMouseButtonPressed = true;
                    _clickedMouseButton     = GameEventKey.MOUSSE_LEFT;

                    if (_activeWidgetId !== -1 && _hoveredWidgetId !== _activeWidgetId)
                    {
                        _nextActiveWidgetId  = -1;
                        _interactingWidgetId = -1;
                    }

                    if (hoveredWidgetSupportLeftMouseClick)
                    {
                        _nextActiveWidgetId    = _hoveredWidgetId;
                        _interactingWidgetId   = _hoveredWidgetId;
                        _lastInteractionTimeUs = _nowUs;
                        hasEventBeenProcessed  = true;
                    }
                }
                else
                {
                    _clickedMouseButtonPressed = false;
                    _clickedMouseButton        = GameEventKey.MOUSSE_LEFT;
                    _interactingWidgetId       = -1;

                    if (_interactingWidgetId !== -1)
                        hasEventBeenProcessed = true;
                }
            }

            // if (event.key === GameEventKey.MOUSSE_SCROLL                    &&
            //     _hoveredWidgetId !== -1                                     &&
            //     _hoveredWidget.capabilities & UiWidgetCapability.SCROLLABLE  )
            // {
            //     hasEventBeenProcessed = _widget_proc(_hoveredWidget, UiWidgetInternalEvent.SCROLL, event);
            // }

            // if (event_is_keyboard(event) &&
            //     event.isPressed          &&
            //     _activeWidgetId !== -1   &&
            //     (_activeWidget.capabilities & UiWidgetCapability.TEXT)
            // )
            // {
            //     _lastInteractionTimeUs = _nowUs;
            //     hasEventBeenProcessed = _widget_proc(_activeWidget, UiWidgetInternalEvent.TEXT, event);
            // }
        }

        // Bugged condition, shall be unstable remove
        if (hasEventBeenProcessed)
            events.length -= 1;
    }

    // if (_isGrabbing            &&
    //     _activeWidget !== null &&
    //     (_activeWidget.capabilities & UiWidgetCapability.GRABBABLE))
    // {
    //     _lastInteractionTimeUs = _nowUs;
    //     _widget_proc(_activeWidget, UiWidgetInternalEvent.DELTA_MOUSE, null);
    // }





    _currentFrameWidget.length = 0;
    return events;
}































////////////////////////////////////////////////////////////
// MARK: GET RECT
////////////////////////////////////////////////////////////
export function gui_rect(id: number, rect: Rect, z: number, capabilities: UiWidgetCapability): UiWidgetState
{
    let widget: UiWidget =
    {
        id  : id,
        rect: {
                  x: rect.x,
                  y: rect.y,
                  width : rect.width,
                  height: rect.height,
              },
        z   : z,

        capabilities: capabilities,
    };

    let state: UiWidgetState = {
                                    flag                   : UiWidgetStateFlag.EMPTY,
                                    consecutiveClickCounter: 0,
                                    lastInteractionTimeUs  : _lastInteractionTimeUs,
                                    id                     : id,
                                    rect                   : widget.rect,
                                    z                      : z
                                };

    if (id === _hoveredWidgetId)
    {
        state.flag |= UiWidgetStateFlag.HOVERED;
        if (id !== _previousHoveredWidgetId)
            state.flag |= UiWidgetStateFlag.START_HOVERED_THIS_FRAME;
    }
    else if (id === _previousHoveredWidgetId)
        state.flag |= UiWidgetStateFlag.STOP_HOVERED_THIS_FRAME;

    if (id === _nextActiveWidgetId)
    {
        state.flag |= UiWidgetStateFlag.ACTIVE;
        if (id !== _activeWidgetId)
            state.flag |= UiWidgetStateFlag.START_ACTIVE_THIS_FRAME | UiWidgetStateFlag.START_INTERACTING_THIS_FRAME;
    }
    else if (id === _activeWidgetId)
        state.flag |= UiWidgetStateFlag.STOP_ACTIVE_THIS_FRAME | UiWidgetStateFlag.STOP_INTERACTING_THIS_FRAME;

    if (id === _interactingWidgetId)
        state.flag |= UiWidgetStateFlag.INTERACTING;

    if (id === _interactingWidgetId)
    {
        if (_clickedMouseButtonPressed)
        {
            if (_clickedMouseButton === GameEventKey.MOUSSE_LEFT)
                state.flag |= UiWidgetStateFlag.LEFT_MOUSE_PRESSED;
            else if (_clickedMouseButton === GameEventKey.MOUSSE_MIDDLE)
                state.flag |= UiWidgetStateFlag.MIDDLE_MOUSE_PRESSED;
            else if (_clickedMouseButton === GameEventKey.MOUSSE_RIGHT)
                state.flag |= UiWidgetStateFlag.RIGHT_MOUSE_PRESSED;

            if (capabilities & UiWidgetCapability.CLICKED_ON_PRESSED)
            {
                if (_clickedMouseButton === GameEventKey.MOUSSE_LEFT)
                    state.flag |= UiWidgetStateFlag.LEFT_MOUSE_CLICKED;
                else if (_clickedMouseButton === GameEventKey.MOUSSE_MIDDLE)
                    state.flag |= UiWidgetStateFlag.MIDDLE_MOUSE_CLICKED;
                else if (_clickedMouseButton === GameEventKey.MOUSSE_RIGHT)
                    state.flag |= UiWidgetStateFlag.RIGHT_MOUSE_CLICKED;
            }
        }
    }
    else if (id === _previousInteractingWidgetId && _clickedMouseButtonPressed === false)
    {
        if (_clickedMouseButton === GameEventKey.MOUSSE_LEFT)
            state.flag |= UiWidgetStateFlag.LEFT_MOUSE_RELEASED;
        else if (_clickedMouseButton === GameEventKey.MOUSSE_MIDDLE)
            state.flag |= UiWidgetStateFlag.MIDDLE_MOUSE_RELEASED;
        else if (_clickedMouseButton === GameEventKey.MOUSSE_RIGHT)
            state.flag |= UiWidgetStateFlag.RIGHT_MOUSE_RELEASED;

        if ((capabilities & UiWidgetCapability.CLICKED_ON_PRESSED) === 0 && id === _hoveredWidgetId)
        {
            if (_clickedMouseButton === GameEventKey.MOUSSE_LEFT)
                state.flag |= UiWidgetStateFlag.LEFT_MOUSE_CLICKED;
            else if (_clickedMouseButton === GameEventKey.MOUSSE_MIDDLE)
                state.flag |= UiWidgetStateFlag.MIDDLE_MOUSE_CLICKED;
            else if (_clickedMouseButton === GameEventKey.MOUSSE_RIGHT)
                state.flag |= UiWidgetStateFlag.RIGHT_MOUSE_CLICKED;

            if ((capabilities & UiWidgetCapability.ACTIVABLE) === 0)
                state.flag |= UiWidgetStateFlag.STOP_INTERACTING_THIS_FRAME;
        }
    }

    _currentFrameWidget.push(widget);
    return state;
}






















////////////////////////////////////////////////////////////
// MARK: WIDGET
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
export function widget_deactivate(widgetId: number)
{
    if (_activeWidgetId === widgetId)
        _nextActiveWidgetId = -1;
}


////////////////////////////////////////////////////////////
export function widget_activate(widget: UiWidget)
{
    _nextActiveWidgetId = widget.id;
}


////////////////////////////////////////////////////////////
export function widget_state_flag_to_string(flag: UiWidgetStateFlag): string
{
    let flagsRepr: string[] = [];

    if (flag === UiWidgetStateFlag.EMPTY)
    {
        flagsRepr.push("EMPTY")
    }
    else
    {
        if (flag & UiWidgetStateFlag.ACTIVE)                       flagsRepr.push("ACTIVE")
        if (flag & UiWidgetStateFlag.START_ACTIVE_THIS_FRAME)      flagsRepr.push("START_ACTIVE_THIS_FRAME")
        if (flag & UiWidgetStateFlag.STOP_ACTIVE_THIS_FRAME)       flagsRepr.push("STOP_ACTIVE_THIS_FRAME")
        if (flag & UiWidgetStateFlag.HOVERED)                      flagsRepr.push("HOVERED")
        if (flag & UiWidgetStateFlag.START_HOVERED_THIS_FRAME)     flagsRepr.push("START_HOVERED_THIS_FRAME")
        if (flag & UiWidgetStateFlag.STOP_HOVERED_THIS_FRAME)      flagsRepr.push("STOP_HOVERED_THIS_FRAME")
        if (flag & UiWidgetStateFlag.LEFT_MOUSE_PRESSED)           flagsRepr.push("LEFT_MOUSE_PRESSED")
        if (flag & UiWidgetStateFlag.MIDDLE_MOUSE_PRESSED)         flagsRepr.push("MIDDLE_MOUSE_PRESSED")
        if (flag & UiWidgetStateFlag.RIGHT_MOUSE_PRESSED)          flagsRepr.push("RIGHT_MOUSE_PRESSED")
        if (flag & UiWidgetStateFlag.LEFT_MOUSE_CLICKED)           flagsRepr.push("LEFT_MOUSE_CLICKED")
        if (flag & UiWidgetStateFlag.MIDDLE_MOUSE_CLICKED)         flagsRepr.push("MIDDLE_MOUSE_CLICKED")
        if (flag & UiWidgetStateFlag.RIGHT_MOUSE_CLICKED)          flagsRepr.push("RIGHT_MOUSE_CLICKED")
        if (flag & UiWidgetStateFlag.LEFT_MOUSE_RELEASED)          flagsRepr.push("LEFT_MOUSE_RELEASED")
        if (flag & UiWidgetStateFlag.MIDDLE_MOUSE_RELEASED)        flagsRepr.push("MIDDLE_MOUSE_RELEASED")
        if (flag & UiWidgetStateFlag.RIGHT_MOUSE_RELEASED)         flagsRepr.push("RIGHT_MOUSE_RELEASED")
        if (flag & UiWidgetStateFlag.INTERACTING)                  flagsRepr.push("INTERACTING")
        if (flag & UiWidgetStateFlag.START_INTERACTING_THIS_FRAME) flagsRepr.push("START_INTERACTING_THIS_FRAME")
        if (flag & UiWidgetStateFlag.STOP_INTERACTING_THIS_FRAME)  flagsRepr.push("STOP_INTERACTING_THIS_FRAME")
        if (flag & UiWidgetStateFlag.KEYBOARD_KEY_PRESSED)         flagsRepr.push("KEYBOARD_KEY_PRESSED")
    }

    return flagsRepr.join(" | ");
}







////////////////////////////////////////////////////////////
// MARK: W/Button
////////////////////////////////////////////////////////////
export function ui_button_logic(id: number, rect: Rect, z: number): UiWidgetState
{
    let state = gui_rect(id, rect, z, UiWidgetCapability.HOVERABLE | UiWidgetCapability.LEFT_CLICK);
    return state;
}





////////////////////////////////////////////////////////////
// MARK: W/Text Editor
////////////////////////////////////////////////////////////
export function ui_text_editor(id: number, rect: Rect, z: number, s: StringUtf32): StringUtf32
{
    let context = _contexts.get(id);
    if (context === undefined)
    {
        if (s === null)
            s = string_to_utf32("", 128*1024);

        context = {
                        font             : _defaultFont,
                        scale            : 1,
                        text             : s,
                        countOfLine      :  0,
                        longestLineCount :  0,
                        cursorPosition   : -1,
                        selectionPosition: -1,
                        offsetX          :  0,
                        offsetY          :  0,
                        isScrolling      : false,
                  };

        // @CopyPasta
        // :computeTextDimensions:
        {
            let data  = s.data;
            let count = s.count;

            let startOfLine      = 0;
            let countOfLine      = 0;
            let longestLineCount = 0;

            while (startOfLine < count)
            {
                let endOfLine = data.indexOf(UTF32_NEW_LINE, startOfLine);
                if (endOfLine === -1) endOfLine = count;

                let lineCount = endOfLine - startOfLine;
                if (lineCount > longestLineCount) longestLineCount = lineCount;

                countOfLine += 1;
                startOfLine = endOfLine + 1;
            }

            context.countOfLine      = countOfLine;
            context.longestLineCount = longestLineCount;
        }

        _contexts.set(id, context);
    }

    // Logic
    {
        let state = gui_rect(id, rect, z, UiWidgetCapability.HOVERABLE | UiWidgetCapability.LEFT_CLICK | UiWidgetCapability.ACTIVABLE);
        // console.log(widget_state_flag_to_string(state.flag));
        let font              = context.font;
        let text              = context.text;
        let data              = text.data;
        let textCount         = text.count;
        let cursorPosition    = context.cursorPosition;
        let selectionPosition = context.selectionPosition;
        let scale             = context.scale;
        let charWidth         = font.width  * scale;
        let charHeight        = font.height * scale;


        if (state.flag & UiWidgetStateFlag.INTERACTING)
        {
            let localMouseX = mouseX - (rect.x + context.offsetX);
            let localMouseY = mouseY - (rect.y + context.offsetY);

            if (state.flag & UiWidgetStateFlag.START_INTERACTING_THIS_FRAME)
            {
                context.cursorPosition    = _find_cursor_position(text, font, scale, localMouseX, localMouseY);
                context.selectionPosition = -1;
            }
            else
            {
                context.selectionPosition = _find_cursor_position(text, font, scale, localMouseX, localMouseY);
            }
        }

    }





    // Draw
    {
        const TEXT_COLOR       = to_color(0.8, 0.8, 0.8, 1);
        const BACKGROUND_COLOR = to_color(0, 0, 0, 1);
        const SELECTION_COLOR  = to_color(0, 0, 0.6, 1);
        const CURSOR_COLOR     = to_color(1, 0, 0, 1);

        let text                    = context.text;
        let data                    = text.data;
        let count                   = text.count;
        let offsetX                 = context.offsetX;
        let offsetY                 = context.offsetY;
        let scale                   = context.scale;
        let startingX               = rect.x + offsetX;
        let x                       = startingX;
        let y                       = rect.y + offsetY;
        let font                    = _defaultFont;
        let glyphWidth              = scale * font.width;
        let lineHeight              = scale * font.height;
        let accumulatedTextLength   = 0
        let cursorPosition          = context.cursorPosition;
        let selectionCursorPosition = context.selectionPosition;
        let shouldShowCursor        = (Math.round((_nowUs - _lastInteractionTimeUs) / 500_000) & 1) === 0;
        let totalHeight             = context.countOfLine * lineHeight;

        let hasScrollBarX           = false;
        let hasScrollBarY           = totalHeight > rect.height;
        let sizeOfScrollCursorX     = 0;
        let sizeOfScrollCursorY     = (rect.height / totalHeight) * rect.height;
        let offsetOfScrollCursorX   = 0;
        let offsetOfScrollCursorY   = (-offsetY) / totalHeight * rect.height;
        let scrollBarThickness      = Math.round(lineHeight * 0.7);

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
        let endOfLine   = string_utf32_index_of(text, UTF32_NEW_LINE);
        if (endOfLine === -1) endOfLine = count;

        while (startOfLine < count)
        {
            let j = startOfLine;
            for (; j < endOfLine ;j+=1)
            {
                if (accumulatedTextLength === startOfSelection) isSelecting = true;
                if (accumulatedTextLength === endOfSelection)   isSelecting = false;

                if (isSelecting)
                    draw_quad(to_rect(x, y, glyphWidth, lineHeight), z + 1, SELECTION_COLOR);

                if (shouldShowCursor && accumulatedTextLength === cursorPosition)
                {
                    let cursorX = x-1;
                    if (cursorX < rect.x) cursorX = rect.x;
                    let cursorRect = to_rect(cursorX, y, scale, lineHeight);
                    draw_quad(cursorRect, z + 3, CURSOR_COLOR);
                }

                accumulatedTextLength += 1;
                x += glyphWidth;
            }

            if (shouldShowCursor && accumulatedTextLength === cursorPosition)
            {
                let cursorX = x-1;
                if (cursorX < rect.x) cursorX = rect.x;
                let cursorRect = to_rect(cursorX, y, scale, lineHeight);
                draw_quad(cursorRect, z + 2, CURSOR_COLOR);
            }

            if (accumulatedTextLength === startOfSelection) isSelecting = true;
            if (accumulatedTextLength === endOfSelection)   isSelecting = false;

            accumulatedTextLength += 1;
            y += lineHeight;
            x = startingX;

            startOfLine = endOfLine + 1;
            endOfLine   = string_utf32_index_of(text, UTF32_NEW_LINE, startOfLine);
            if (endOfLine === -1) endOfLine = count;
        }

        if (shouldShowCursor && accumulatedTextLength === cursorPosition)
        {
            let cursorX = x-1;
            if (cursorX < rect.x) cursorX = rect.x;
            let cursorRect = to_rect(cursorX, y, scale, lineHeight);
            draw_quad(cursorRect, z + 2, CURSOR_COLOR);
        }


        x = startingX;
        y = rect.y + offsetY;

        for (let i=0; i < count ;i+=1)
        {
            let unicode = data[i];
            if (unicode === UTF32_NEW_LINE)
            {
                y += lineHeight;
                x = startingX;
            }
            else
            {
                font_draw_ascii(x, y, z + 2, font, scale, unicode, TEXT_COLOR);
                x += glyphWidth;
            }
        }

        scissor_pop();

        if (hasScrollBarY)
        {
            let backgroundScrollBarRect = to_rect(rect.x + rect.width - scrollBarThickness, rect.y                        , scrollBarThickness, rect.height);
            let scrollBarCursorRect     = to_rect(rect.x + rect.width - scrollBarThickness, rect.y + offsetOfScrollCursorY, scrollBarThickness, sizeOfScrollCursorY);
            draw_quad(backgroundScrollBarRect, z + 5, BACKGROUND_COLOR);
            draw_quad(scrollBarCursorRect    , z + 6, TEXT_COLOR);
        }
    }

    return context.text;
}





interface TextEditorContext
{
    // Text
    font             : MonoFont;
    scale            : number;
    countOfLine      : number;
    longestLineCount : number;
    cursorPosition   : number;
    selectionPosition: number;
    text             : StringUtf32;

    // Scroll
    offsetX    : number;
    offsetY    : number;
    isScrolling: boolean;
}
let _contexts : Map<number, TextEditorContext> = new Map();
let _textWordNavigation = GameEventModifier.CONTROL;



////////////////////////////////////////////////////////////
function _find_cursor_position(s: StringUtf32, font: MonoFont, scale: number, x: number, y: number): number
{
    let data  = s.data;
    let count = s.count;

    let cursorPosition = -1;
    let glyphWidth     = font.width  * scale;
    let lineHeight     = font.height * scale;
    let cursorX        = Math.round(x / glyphWidth);
    let cursorY        = Math.floor(y / lineHeight);
    let startOfLine    = 0;
    let endOfLine      = 0;
    let lineNumber     = 0;

    while (endOfLine !== -1)
    {
        endOfLine = string_utf32_index_of(s, UTF32_NEW_LINE, startOfLine);

        if (lineNumber === cursorY)
        {
            if (endOfLine === -1)
                endOfLine = count;

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
        if (y > 0) cursorPosition = count;
        else       cursorPosition = 0;
    }

    return cursorPosition;
}


////////////////////////////////////////////////////////////
function _text_delete_insert(s: StringUtf32, startOfDeletion: number, endOfDeletion: number, insertion: StringUtf32)
{
    s.data.copyWithin(startOfDeletion + insertion.count, endOfDeletion);
    s.data.set(insertion.data, startOfDeletion);
    s.count += insertion.count - (endOfDeletion - startOfDeletion);
}


////////////////////////////////////////////////////////////
function _text_delete_insert_one(s: StringUtf32, startOfDeletion: number, endOfDeletion: number, insertion: number)
{
    s.data.copyWithin(startOfDeletion + 1, endOfDeletion);
    s.data[startOfDeletion] = insertion;
    s.count += 1 - (endOfDeletion - startOfDeletion);
}


////////////////////////////////////////////////////////////
function _text_delete_insert_string(s: StringUtf32, startOfDeletion: number, endOfDeletion: number, insertion: string)
{
    let data            = s.data;
    let insertionLength = insertion.length;

    data.copyWithin(startOfDeletion + insertionLength, endOfDeletion);
    for (let i=0; i < insertionLength ;i+=1)
        data[startOfDeletion+i] = insertion.charCodeAt(i);
    s.count += insertionLength - (endOfDeletion - startOfDeletion);
}






////////////////////////////////////////////////////////////
function _text_start_of_line_for(s: StringUtf32, cursorPosition: number): number
{
    let startOfLine = string_utf32_last_index_of(s, UTF32_NEW_LINE, cursorPosition - 1) + 1;
    if (cursorPosition === 0) startOfLine = 0;
    return startOfLine;
}


////////////////////////////////////////////////////////////
function _text_get_line_containing_cursor(s: StringUtf32, cursorPosition: number): [number, number]
{
    let startOfLine = string_utf32_last_index_of(s, UTF32_NEW_LINE, cursorPosition - 1) + 1;
    let endOfLine   = string_utf32_index_of(s, UTF32_NEW_LINE, cursorPosition);
    if (cursorPosition ===  0) startOfLine = 0;
    if (endOfLine      === -1) endOfLine   = s.count;
    return [startOfLine, endOfLine];
}


////////////////////////////////////////////////////////////
function _text_get_cursor_or_end_of_line(s: StringUtf32, startOfLine: number, offset: number): number
{
    let endOfLine = string_utf32_index_of(s, UTF32_NEW_LINE, startOfLine);
    if (endOfLine === -1) endOfLine = s.count;
    let lineCount = endOfLine - startOfLine;
    if (offset > lineCount) offset = lineCount;
    return startOfLine + offset;
}


////////////////////////////////////////////////////////////
function _text_get_previous_word(s: StringUtf32, cursor: number): number
{
    let data = s.data;

    while (cursor > 0 && char_is_identifier(data[cursor-1]) == false)
        cursor -= 1;

    while (cursor > 0 && char_is_identifier(data[cursor-1]))
        cursor -= 1;

    return cursor;
}


////////////////////////////////////////////////////////////
function _text_get_next_word(s: StringUtf32, cursor: number): number
{
    let data  = s.data;
    let count = s.count;

    while (cursor < count && char_is_identifier(data[cursor]) == false)
        cursor += 1;

    while (cursor < count && char_is_identifier(data[cursor]))
        cursor += 1;

    while (cursor < count && char_is_identifier(data[cursor]) == false)
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

}















////////////////////////////////////////////////////////////
function _widget_proc(widget: UiWidget, eventType: UiWidgetInternalEvent, event: GameEvent | null): boolean
{
    let hasEventBeenProcessed = false;
    let context               = _contexts.get(widget.id);

    if (widget.capabilities & UiWidgetCapability.TEXT)
    {
        if (context === undefined)
        {
            console.error(`Text input id [${widget.id}] does not have a context`);
            return false;
        }

         // Can only be used for read
        let font              = context.font;
        let text              = context.text;
        let data              = text.data;
        let textCount         = text.count;
        let cursorPosition    = context.cursorPosition;
        let selectionPosition = context.selectionPosition;
        let scale             = context.scale;
        let rect              = widget.rect;
        let charWidth         = font.width  * scale;
        let charHeight        = font.height * scale;

        if (eventType === UiWidgetInternalEvent.ACTIVATION)
        {
            if (cursorPosition === -1)
            {
                cursorPosition         = 0;
                context.cursorPosition = 0;
            }

            console.log("Text ACTIVATION");
            // @Incomplete:
            //     Add option to be set at the start or at the end
            if ((widget.capabilities & UiWidgetCapability.TEXT_KEEP_STATE_AFTER_DE_ACTIVATION) === 0)
            {
                context.cursorPosition    = text.count;
                context.selectionPosition = -1;
            }

            hasEventBeenProcessed = true;
        }

        else if (eventType === UiWidgetInternalEvent.CLICKED)
        {
            context.isScrolling   = false;
            hasEventBeenProcessed = true;

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
                // @ts-ignore
                let consecutiveClickCounter = (event.data as number) % 5;
                console.log("clicked", consecutiveClickCounter)

                if (consecutiveClickCounter === 0)
                {
                    context.cursorPosition    = _find_cursor_position(text, font, scale, localMouseX, localMouseY);
                    context.selectionPosition = context.cursorPosition;
                }
                else if (consecutiveClickCounter === 1)
                {

                }
                else if (consecutiveClickCounter === 2)
                {
                    let [startOfCursorLine, endOfCursorLine] = _text_get_line_containing_cursor(text, cursorPosition);
                    context.cursorPosition    = startOfCursorLine;
                    context.selectionPosition = endOfCursorLine;
                    console.log("A", context.cursorPosition)
                    console.log("V", context.selectionPosition)
                }
                else if (consecutiveClickCounter === 3)
                {
                    context.cursorPosition    = 0;
                    context.selectionPosition = textCount;
                }
            }

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
            const AUTO_SCROLL_THICKNESS_IN_PIXEL = 3;

            if (mouseX < (rect.x + AUTO_SCROLL_THICKNESS_IN_PIXEL))
            {
                context.offsetX += charWidth;
                if (context.offsetX > 0) context.offsetX = 0;
            }
            else if (mouseX > (rect.x + rect.width - AUTO_SCROLL_THICKNESS_IN_PIXEL))
            {
                // @Speed
                let [startOfCursorLine, endOfCursorLine] = _text_get_line_containing_cursor(text, cursorPosition);
                let lineCount                            = endOfCursorLine - startOfCursorLine;
                let lineWidth                            = (lineCount + 1) * charWidth;
                let maxWidth                             = lineWidth - rect.width;
                if (maxWidth < 0) maxWidth = 0;

                context.offsetX -= charWidth;
                if (context.offsetX < -maxWidth) context.offsetX = -maxWidth;
            }


            if (mouseY < (rect.y + AUTO_SCROLL_THICKNESS_IN_PIXEL))
            {
                context.offsetY += charHeight;
                if (context.offsetY > 0) context.offsetY = 0;
            }
            else if (mouseY > (rect.y + rect.height - AUTO_SCROLL_THICKNESS_IN_PIXEL))
            {
                let maxHeight = context.countOfLine * charHeight - rect.height;
                if (maxHeight < 0) maxHeight = 0;

                context.offsetY -= charHeight;
                if (context.offsetY < -maxHeight) context.offsetY = -maxHeight;
            }

            let localMouseX = mouseX - (rect.x + context.offsetX);
            let localMouseY = mouseY - (rect.y + context.offsetY);

            context.cursorPosition = _find_cursor_position(text, font, scale, localMouseX, localMouseY);
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
                let scrollX = event.data.x as number;

                context.offsetX -= scrollX;
                if (context.offsetX > 0) context.offsetX = 0;

                let maxWidth = context.longestLineCount * charWidth - rect.width;
                if (maxWidth < 0) maxWidth = 0;
                if (context.offsetX < -maxWidth) context.offsetX = -maxWidth;


                // @ts-ignore
                let scrollY = event.data.y as number;

                context.offsetY -= scrollY;
                if (context.offsetY > 0) context.offsetY = 0;

                let maxHeight = context.countOfLine * charHeight - rect.height;
                if (maxHeight < 0) maxHeight = 0;
                if (context.offsetY < -maxHeight) context.offsetY = -maxHeight;
            }

            hasEventBeenProcessed = true;
        }

        else if (eventType === UiWidgetInternalEvent.UN_GRABBED)
        {
            if (cursorPosition === context.selectionPosition) context.selectionPosition = -1;
        }

        else if (eventType === UiWidgetInternalEvent.TEXT)
        {
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

                        if (event.modifier & _textWordNavigation)
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

                            if (event.modifier & _textWordNavigation)
                                context.cursorPosition = _text_get_previous_word(text, context.cursorPosition);
                        }
                        else
                        {
                            if (event.modifier & _textWordNavigation)
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

                        if (event.modifier & _textWordNavigation)
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

                            if (event.modifier & _textWordNavigation)
                                context.cursorPosition = _text_get_next_word(text, context.cursorPosition);
                        }
                        else
                        {
                            if (event.modifier & _textWordNavigation)
                                context.cursorPosition = _text_get_next_word(text, cursorPosition);
                            else
                                context.cursorPosition += 1;
                        }
                    }

                    if (context.cursorPosition > context.text.count) context.cursorPosition = context.text.count;

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

                    if (context.cursorPosition > context.text.count) context.cursorPosition = context.text.count;

                    hasEventBeenProcessed = true;
                }

                else if (event.key === GameEventKey.ARROW_UP)
                {
                    let [startOfLine, _]         = _text_get_line_containing_cursor(text, context.cursorPosition);
                    let offsetFromStartOfLine    = context.cursorPosition - startOfLine;
                    let startOfPreviousLine      = 0;
                    let cursorPositionOnNextLine = 0;

                    if (startOfLine !== 0)
                    {
                        [startOfPreviousLine, _] = _text_get_line_containing_cursor(text, startOfLine - 1);
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

                    if (context.cursorPosition > context.text.count) context.cursorPosition = context.text.count;

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

                    if (startOfDeletion >= 0 && startOfDeletion < text.count)
                    {
                        // _text_push_mutation(context.rewinder, text, startOfDeletion, endOfDeletion, "");
                        _text_delete_insert_string(text, startOfDeletion, endOfDeletion, "");
                        context.cursorPosition = startOfDeletion;
                    }

                    context.selectionPosition = -1;
                    hasEventBeenProcessed     = true;
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

                else if (event.key === GameEventKey.SELECT_ALL)
                {
                    context.cursorPosition    = text.count;
                    context.selectionPosition = 0;
                }

                else if (event.key === GameEventKey.COPY)
                {
                    let startOfCopy = Math.min(context.cursorPosition, context.selectionPosition);
                    let endOfCopy   = Math.max(context.cursorPosition, context.selectionPosition);

                    if (context.selectionPosition === -1 || startOfCopy === endOfCopy)
                    {
                        [startOfCopy, endOfCopy] = _text_get_line_containing_cursor(text, context.cursorPosition);
                    }

                    let textView = text.data.slice(1+startOfCopy, 1+endOfCopy);
                    let asString = String.fromCodePoint(...textView);
                    clipboard_push(asString);
                }

                else if (event.key === GameEventKey.CUT)
                {
                    let startOfCopy = Math.min(context.cursorPosition, context.selectionPosition);
                    let endOfCopy   = Math.max(context.cursorPosition, context.selectionPosition);

                    if (context.selectionPosition === -1 || startOfCopy === endOfCopy)
                    {
                        [startOfCopy, endOfCopy] = _text_get_line_containing_cursor(text, context.cursorPosition);
                    }

                    let textView = text.data.slice(1+startOfCopy, 1+endOfCopy);
                    let asString = String.fromCodePoint(...textView);
                    clipboard_push(asString);

                    // _text_push_mutation(context.rewinder, text, startOfCopy, endOfCopy, "");
                    _text_delete_insert_string(text, startOfCopy, endOfCopy, "");
                    context.cursorPosition    = startOfCopy;
                    context.selectionPosition = -1;
                    hasEventBeenProcessed     = true;
                }

                else if (event.key === GameEventKey.PASTE)
                {
                    let pastedText      = event.data as string;
                    let startOfDeletion = context.cursorPosition;
                    let endOfDeletion   = context.cursorPosition;

                    if (context.selectionPosition !== -1)
                    {
                        startOfDeletion = Math.min(context.selectionPosition, context.cursorPosition);
                        endOfDeletion   = Math.max(context.selectionPosition, context.cursorPosition);
                    }

                    _text_delete_insert_string(text, startOfDeletion, endOfDeletion, pastedText);
                    context.cursorPosition = startOfDeletion + pastedText.length;
                    hasEventBeenProcessed  = true;
                }

                else if (event.key === GameEventKey.UNDO)
                {
                    if (event.modifier & GameEventModifier.SHIFT)
                    {
                        let mutation = rewinder_redo_mutation(context.rewinder);
                        if (mutation !== null)
                        {
                            _text_delete_insert(text, mutation.cursor,  mutation.cursor + mutation.deletedText.length, mutation.insertedText);
                            context.cursorPosition = mutation.cursor + mutation.insertedText.length;
                        }
                    }
                    else
                    {
                        let mutation = rewinder_pop_mutation(context.rewinder);
                        if (mutation !== null)
                        {

                            _text_delete_insert(text, mutation.cursor, mutation.cursor + mutation.insertedText.length, mutation.deletedText);
                            context.cursorPosition = mutation.cursor + mutation.deletedText.length;
                        }
                    }

                    context.selectionPosition = -1;
                    hasEventBeenProcessed     = true;
                }

                else if (event_is_printable(event))
                {
                    if (event.key === GameEventKey.TAB && context.selectionPosition !== -1)
                    {
                        let startOfIndent = Math.min(cursorPosition, context.selectionPosition);
                        let endOfIndent   = Math.max(cursorPosition, context.selectionPosition);

                        let startOfLine     = _text_start_of_line_for(text, startOfIndent);
                        let startOfLastLine = _text_start_of_line_for(text, endOfIndent);

                        if (event.modifier & GameEventModifier.SHIFT)
                        {
                            let countOfSpaceDeleted               = 0;
                            let countOfSpaceDeletedOnTheFirstLine = 0;
                            let isOnFirstLine                     = true;

                            while (startOfLine !== startOfLastLine)
                            {
                                if(data[startOfLine] !== 32)
                                {
                                    startOfLine   = string_utf32_index_of(text, UTF32_NEW_LINE, startOfLine) + 1;
                                    isOnFirstLine = false;
                                    continue;
                                }

                                let countOfSpaceAtTheBeginingOfTheLine = 0;
                                while (data[startOfLine + countOfSpaceAtTheBeginingOfTheLine] === 32)
                                    countOfSpaceAtTheBeginingOfTheLine += 1;

                                if (countOfSpaceAtTheBeginingOfTheLine > 4) countOfSpaceAtTheBeginingOfTheLine = 4;

                                if (isOnFirstLine)
                                {
                                    countOfSpaceDeletedOnTheFirstLine = countOfSpaceAtTheBeginingOfTheLine;
                                    isOnFirstLine                     = false;
                                }

                                _text_delete_insert_string(text, startOfLine, startOfLine + countOfSpaceAtTheBeginingOfTheLine, "");
                                startOfLine = string_utf32_index_of(text, UTF32_NEW_LINE, startOfLine) + 1;
                                startOfLastLine     -= countOfSpaceAtTheBeginingOfTheLine;
                                countOfSpaceDeleted += countOfSpaceAtTheBeginingOfTheLine;
                            }

                            {
                                let countOfSpaceAtTheBeginingOfTheLine = 0;
                                while (data[startOfLine + countOfSpaceAtTheBeginingOfTheLine] === 32)
                                    countOfSpaceAtTheBeginingOfTheLine += 1;

                                if (countOfSpaceAtTheBeginingOfTheLine > 4) countOfSpaceAtTheBeginingOfTheLine = 4;

                               if (isOnFirstLine)
                                    countOfSpaceDeletedOnTheFirstLine = countOfSpaceAtTheBeginingOfTheLine;

                                _text_delete_insert_string(text, startOfLine, startOfLine + countOfSpaceAtTheBeginingOfTheLine, "");
                                countOfSpaceDeleted += countOfSpaceAtTheBeginingOfTheLine;
                            }

                            if (context.cursorPosition < context.selectionPosition)
                            {
                                context.cursorPosition    -= countOfSpaceDeletedOnTheFirstLine;
                                context.selectionPosition -= countOfSpaceDeleted;
                            }
                            else
                            {
                                context.cursorPosition    -= countOfSpaceDeleted;
                                context.selectionPosition -= countOfSpaceDeletedOnTheFirstLine;
                            }
                        }
                        else
                        {
                            let countOfLineIndented = 1;

                            while (startOfLine !== startOfLastLine)
                            {
                                let endOfLine = string_utf32_index_of(text, UTF32_NEW_LINE, startOfLine) + 1;
                                if ((endOfLine - startOfLine) === 1)
                                {
                                    startOfLine += 1;
                                    continue;
                                }

                                _text_delete_insert_string(text, startOfLine, startOfLine, "    ");
                                startOfLine = endOfLine + 4;
                                startOfLastLine     += 4;
                                countOfLineIndented += 1;
                            }

                            _text_delete_insert_string(text, startOfLine, startOfLine, "    ");

                            if (context.cursorPosition < context.selectionPosition)
                            {
                                context.cursorPosition    += 4;
                                context.selectionPosition += 4*countOfLineIndented;
                            }
                            else
                            {
                                context.cursorPosition    += 4*countOfLineIndented;
                                context.selectionPosition += 4;
                            }
                        }
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
                        if (event.key === GameEventKey.TAB)
                            textToInsert = "    ";

                        // _text_push_mutation(context.rewinder, text, startOfDeletion, endOfDeletion, textToInsert);
                        _text_delete_insert_string(text, startOfDeletion, endOfDeletion, textToInsert);
                        context.cursorPosition = startOfDeletion + textToInsert.length;

                        context.selectionPosition = -1;
                        hasEventBeenProcessed = true;
                    }
                }

                else if (event.key === GameEventKey.ENTER)
                {
                    if (context.cursorPosition >= 0)
                    {
                        let startOfDeletion = context.cursorPosition;
                        let endOfDeletion   = context.cursorPosition;

                        if (context.selectionPosition !== -1)
                        {
                            startOfDeletion = Math.min(context.selectionPosition, context.cursorPosition);
                            endOfDeletion   = Math.max(context.selectionPosition, context.cursorPosition);
                        }

                        _text_delete_insert_one(text, startOfDeletion, endOfDeletion, UTF32_NEW_LINE);
                        context.cursorPosition    = startOfDeletion + 1;
                        context.selectionPosition = -1;
                        hasEventBeenProcessed     = true;
                    }
                }
            }
        }



        if (hasEventBeenProcessed       &&
            context.cursorPosition >= 0 &&
            context.isScrolling === false)
        {
            {
                let buffer    = text;
                let textCount = text.count;

                // @CopyPasta
                // :computeTextDimensions:
                let startOfLine      = 0;
                let countOfLine      = 0;
                let longestLineCount = 0;

                while (startOfLine < textCount)
                {
                    let endOfLine = string_utf32_index_of(text, UTF32_NEW_LINE, startOfLine);
                    if (endOfLine === -1) endOfLine = textCount;

                    let lineCount = endOfLine - startOfLine;
                    if (lineCount > longestLineCount) longestLineCount = lineCount;

                    countOfLine += 1;
                    startOfLine = endOfLine + 1;
                }

                context.countOfLine      = countOfLine;
                context.longestLineCount = longestLineCount;
            }

            let offsetRectInChar: Rect = to_rect(context.offsetX, context.offsetY, rect.width, rect.height);
            offsetRectInChar.x = Math.floor(offsetRectInChar.x / charWidth);
            offsetRectInChar.y = Math.floor(offsetRectInChar.y / charHeight);
            offsetRectInChar.width  = Math.floor(offsetRectInChar.width  / charWidth);
            offsetRectInChar.height = Math.floor(offsetRectInChar.height / charHeight);

            // console.log(offsetRectInChar);

            let startOfCursorLine = _text_start_of_line_for(text, context.cursorPosition);
            let cursorX           = context.cursorPosition - startOfCursorLine;
            let cursorY           = string_utf32_count(text, UTF32_NEW_LINE, 0, context.cursorPosition);

            // console.log(cursorX, cursorY);

            if ((cursorY + offsetRectInChar.y) >= offsetRectInChar.height) context.offsetY = (offsetRectInChar.height - cursorY - 1) * charHeight;
            if ((cursorY + offsetRectInChar.y) < 0)                        context.offsetY = -cursorY * charHeight;

            if ((cursorX + offsetRectInChar.x) >= offsetRectInChar.width) context.offsetX = (offsetRectInChar.width - cursorX) * charWidth;
            if ((cursorX + offsetRectInChar.x) < 0)                       context.offsetX = -cursorX * charWidth;


        }
    }

    if (context !== undefined)
    {
        console.log("A2", context.cursorPosition, context.selectionPosition, eventType, event);
    }

    return hasEventBeenProcessed;
}