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


















export const UTF32_NEW_LINE = 10;


////////////////////////////////////////////////////////////
export function string_utf32_count(haystack: Uint32Array, needle: number, startOfSearch: number =0, endOfSearch: number =-1): number
{
    startOfSearch += 1;
    if (endOfSearch === -1) endOfSearch = haystack[0];
    else                    endOfSearch +=1;
    let occurenceCount = 0;
    let i              = 0;
    let haystackCount  = haystack[0];

    while (i < haystackCount)
    {
        let indexOfNextOccurrence = haystack.indexOf(needle, startOfSearch);
        if (indexOfNextOccurrence === -1)         break;
        if (indexOfNextOccurrence >= endOfSearch) break;

        occurenceCount += 1;
        startOfSearch = indexOfNextOccurrence + 1;
    }

    return occurenceCount;
}