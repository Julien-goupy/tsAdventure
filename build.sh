esbuild main.ts --bundle --outfile=ressource/pre_main.c --platform=browser --format=esm
gcc -E -P ./ressource/pre_main.c -o ./ressource/main.js
# terser ressource/main.js --output ressource/main2.js --compress passes=3,dead_code=true,pure_funcs=[Math.floor],pure_getters=true,unsafe=true,unsafe_comps=true,unsafe_proto=true,inline=3,reduce_vars=true,collapse_vars=true,sequences=true,join_vars=true,hoist_funs=true,booleans_as_integers=true,keep_fargs=false,keep_infinity=true --mangle reserved=[document,window],toplevel=true
# brotli ./ressource/main2.js -o ./ressource/main3.js -k -f -q 11 -w 0