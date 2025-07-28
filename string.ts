////////////////////////////////////////////////////////////
export function char_is_space(s: string, i: number): boolean
{
    let c = s.charCodeAt(i);
    return (c === 32 ||  // " "
            c ===  9 ||  // "\t"
            c === 10 ||  // "\n"
            c === 11 ||  // "\v"
            c === 12 ||  // "\f"
            c === 13  ); // "\r"
    // Omit unicode spaces.....
}


////////////////////////////////////////////////////////////
export function char_is_alphanum(s: string, i: number): boolean
{
    let c = s.charCodeAt(i);
    return (65 <= c && c <=  90) ||
           (48 <= c && c <=  57) ||
           (97 <= c && c <= 122)  ;
}


////////////////////////////////////////////////////////////
export function char_is_identifier(s: string, i: number): boolean
{
    let c = s.charCodeAt(i);
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