import { event_get_frame_event, GameEvent } from "./event";
import { gui_init_frame, gui_prepare_new_frame, gui_process_event } from "./gui";
import { Rect, renderer_get_window_info, renderer_immediate_flush, renderer_start_frame } from "./renderer";



////////////////////////////////////////////////////////////
// MARK: PLATFORM
////////////////////////////////////////////////////////////
export const enum Platform
{
    UNKNOWN = 0,

    APPLE   = 1 << 0,
    WINDOWS = 1 << 1,
    LINUX   = 1 << 2,

    DESKTOP = 1 << 10,
    MOBILE  = 1 << 11,
    TABLET  = 1 << 12,
}

export function platform_get(): Platform
{
    let platform       = Platform.UNKNOWN;
    let platformString = window.navigator.userAgent.toLowerCase();
    if (platformString.indexOf("mac") !== -1) platform |= Platform.APPLE;
    return platform;
}











////////////////////////////////////////////////////////////
// MARK: LOGIC CONTROLER
////////////////////////////////////////////////////////////
export interface LogicControler
{
    init  : () => void;
    deinit: () => void;

    process_event: (events: GameEvent[]) => void;
    simulate     : (elapsedTime: number, frameId: number) => void;
    draw         : (windowRect: Rect, frameId: number) => void;
}


let _currentControler = null as unknown as LogicControler;
let _now              = 0;
let _lastFrameTime    = 0;
let _frameId          = 0;


////////////////////////////////////////////////////////////
export function logic_set_controler(newControler: LogicControler)
{
    platform_get();
    if (_currentControler !== null) _currentControler.deinit();
    _currentControler = newControler;
    _currentControler.init();
    _now = performance.now();
}


////////////////////////////////////////////////////////////
export function game_render_one_frame()
{
    let startOfFrame = performance.now();

    let [windowRect, windowWidthInPixel, windowHeightInPixel] = renderer_get_window_info();
    renderer_start_frame();
    let events = event_get_frame_event();
    gui_init_frame();

    _lastFrameTime = _now;
    _now = performance.now();
    let elapsedTime = _now - _lastFrameTime;

    events = gui_process_event(events);
    _currentControler.process_event(events);

    gui_prepare_new_frame();

    _currentControler.simulate(elapsedTime, _frameId);
    _currentControler.draw(windowRect, _frameId);

    renderer_immediate_flush();
    _frameId += 1;

    let endOfFrame = performance.now();
    // console.log("Frame duration", endOfFrame - startOfFrame);

    requestAnimationFrame(game_render_one_frame);
}