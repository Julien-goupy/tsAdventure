////////////////////////////////////////////////////////////
export function char_is_space(c: number): boolean
{
    return (c === 32 ||  // " "
            c ===  9 ||  // "\t"
            c === 10 ||  // "\n"
            c === 11 ||  // "\v"
            c === 12 ||  // "\f"
            c === 13  ); // "\r"
    // Omit unicode spaces.....
}


////////////////////////////////////////////////////////////
export function char_is_alphanum(c: number): boolean
{
    return (65 <= c && c <=  90) ||
           (48 <= c && c <=  57) ||
           (97 <= c && c <= 122)  ;
}


////////////////////////////////////////////////////////////
export function char_is_identifier(c: number): boolean
{
    return (65 <= c && c <=  90) ||
           (48 <= c && c <=  57) ||
           (97 <= c && c <= 122) ||
           c === 95 ;
}



////////////////////////////////////////////////////////////
export function string_count(haystack: string, needle: string, startOfSearch: number =0, endOfSearch: number =-1): number
{
    if (endOfSearch === -1) endOfSearch = haystack.length;
    let occurenceCount = 0;
    let i              = 0;
    let haystackCount  = haystack.length;
    let needleCount    = needle.length;

    while (i < haystackCount)
    {
        let indexOfNextOccurrence = haystack.indexOf(needle, startOfSearch);
        if (indexOfNextOccurrence === -1)         break;
        if (indexOfNextOccurrence >= endOfSearch) break;

        occurenceCount += 1;
        startOfSearch = indexOfNextOccurrence + needleCount;
    }

    return occurenceCount;
}


////////////////////////////////////////////////////////////
export function string_to_utf32(s: string, granularity: number =128*1024): StringUtf32
{
    let textCount      = s.length;
    let bufferCapacity = textCount;
    if (bufferCapacity < granularity) bufferCapacity = granularity;
    else                              bufferCapacity = Math.ceil(textCount / (granularity)) * granularity;
    let buffer = new Uint32Array(bufferCapacity);

    for (let i=0; i < textCount ;i+=1)
        buffer[i] = s.charCodeAt(i);

    return {
             data : buffer,
             count: textCount,
           };
}
















export const UTF32_NEW_LINE = 10;

export interface StringUtf32
{
    data : Uint32Array;
    count: number;
}


////////////////////////////////////////////////////////////
export function string_utf32_index_of(s: StringUtf32, utf32: number, start: number =-1): number
{
    let data  = s.data;
    let count = s.count;

    if (start === -1)
        start = 0;

    let index = data.indexOf(utf32, start);
    if (index === -1)  return -1;
    if (index > count) return -1;
    return index;
}


////////////////////////////////////////////////////////////
export function string_utf32_last_index_of(s: StringUtf32, utf32: number, start: number =-1): number
{
    let data  = s.data;
    let count = s.count;

    if (start === -1)
        start = count;

    let index = data.lastIndexOf(utf32, start);
    if (index === -1)  return -1;
    if (index > count) return -1;
    return index;
}


////////////////////////////////////////////////////////////
export function string_utf32_count(haystack: StringUtf32, needle: number, startOfSearch: number =0, endOfSearch: number =-1): number
{
    let data           = haystack.data;
    let count          = haystack.count;
    let occurenceCount = 0;

    if (endOfSearch === -1)
        endOfSearch = count;

    while (true)
    {
        let indexOfNextOccurrence = data.indexOf(needle, startOfSearch);
        if (indexOfNextOccurrence === -1)         break;
        if (indexOfNextOccurrence >= endOfSearch) break;

        occurenceCount += 1;
        startOfSearch = indexOfNextOccurrence + 1;
    }

    return occurenceCount;
}