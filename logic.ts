import { event_get_frame_event, GameEvent } from "./event";
import { gui_process_event } from "./gui";
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
let _lastFrameTimeUs  = 0;
let _frameId          = 0;
export let _timeAtProgramStartUs = 0;
export let _nowUs                = 0;
export let _elapsedTimeUs        = 0;


////////////////////////////////////////////////////////////
export function logic_set_controler(newControler: LogicControler)
{
    platform_get();
    if (_currentControler !== null) _currentControler.deinit();
    _currentControler = newControler;
    _currentControler.init();

    _nowUs = Math.round(performance.now() * 1000);
}


////////////////////////////////////////////////////////////
export function game_render_one_frame(nowMs: number)
{
    let startOfFrameUs = Math.round(nowMs * 1000);

    let [windowRect, windowWidthInPixel, windowHeightInPixel] = renderer_get_window_info();
    renderer_start_frame();
    let events = event_get_frame_event();

    _lastFrameTimeUs = _nowUs;
    _nowUs           = startOfFrameUs;
    _elapsedTimeUs   = _nowUs - _lastFrameTimeUs;

    events = gui_process_event(events);
    _currentControler.process_event(events);

    _currentControler.simulate(_elapsedTimeUs, _frameId);
    _currentControler.draw(windowRect, _frameId);

    renderer_immediate_flush();
    _frameId += 1;

    let endOfFrameUs  = Math.round(performance.now() * 1000);
    let frameDuration = (endOfFrameUs - startOfFrameUs) / 1000;
    // console.log("Frame duration", frameDuration);

    requestAnimationFrame(game_render_one_frame);
}