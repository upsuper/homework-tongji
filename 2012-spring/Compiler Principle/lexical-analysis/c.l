%option noyywrap

%x CHARCONST
%x STRING
%x COMMENT

hex_quad    ([:xdigit:]{4})
ucn         (\\u{hex_quad}|\\U{hex_quad}{hex_quad})
nondigit    [_[:alpha:]]
ident       (({nondigit}|{ucn})([_[:alnum:]]|{ucn})*)

nonz_digit  [1-9]
dec_const   ({nonz_digit}[[:digit:]]*)
oct_digit   [0-7]
oct_const   (0{oct_digit}*)
hex_const   (0[xX][[:xdigit:]]+)
int_suffix  ([uU]?[lL]{0,2})
int_const   (({dec_const}|{oct_digit}|{hex_const}){int_suffix})

sign        [+-]
digit_seq   ([[:digit:]]+)
exp_part    ([eE]{sign}?{digit_seq})
float_suf   [fFlL]
frac_const  ({digit_seq}?\.{digit_seq}|{digit_seq}\.)
dec_float   ({frac_const}{exp_part}?|{digit_seq}{exp_part})
hex_seq     ([[:xdigit:]]+)
hex_frac    ({hex_seq}?\.{hex_seq}|{hex_seq}\.)
bin_exp     ([pP]{sign}?{digit_seq})
hex_float   (0[xX]({frac_const}{bin_exp}|{hex_seq}{bin_exp}))
flo_const   (({dec_float}|{hex_float}){float_suf})

%top{
    #define TOKEN(t) { \
            fprintf(yyout, t "\t"); \
            ECHO; fputs("\n", yyout); \
            }
    #define TOK_PREPROCESSING TOKEN("preprocessing")
    #define TOK_KEYWORD TOKEN("keyword\t")
    #define TOK_IDENTIFIER TOKEN("identifier")
    #define TOK_CONSTANT TOKEN("constant")
    #define TOK_STRING_LITERAL TOKEN("string-literal")
    #define TOK_PUNCTUATOR TOKEN("punctuator")
}

%%

^[[:blank:]]*\#.*(\\\n.*)*  TOK_PREPROCESSING;

auto        |
break       |
case        |
char        |
const       |
continue    |
default     |
do          |
double      |
else        |
enum        |
extern      |
float       |
for         |
goto        |
if          |
inline      |
int         |
long        |
register    |
restrict    |
return      |
short       |
signed      |
sizeof      |
static      |
switch      |
typedef     |
union       |
unsigned    |
void        |
volatile    |
while       |
_Bool       |
_Complex    |
_Imaginary  TOK_KEYWORD;

{ident}     TOK_IDENTIFIER;

{int_const} |
{flo_const} TOK_CONSTANT;
L?\'        BEGIN(CHARCONST); yymore();
<CHARCONST>{
    \'      BEGIN(INITIAL); TOK_CONSTANT;
    \n      |
    <<EOF>> YY_FATAL_ERROR("Unterminated character constant");
    \\.     yymore();
    .       yymore();
}

L?\"        BEGIN(STRING); yymore();
<STRING>{
    \"      BEGIN(INITIAL); TOK_STRING_LITERAL;
    \n      |
    <<EOF>> YY_FATAL_ERROR("Unterminated string");
    \\.     yymore();
    .       yymore();
}

"["|"]"     |
"("|")"     |
"{"|"}"     |
"."|"->"    |
"++"|"--"   |
"&"|"*"     |
"+"|"-"     |
"~"|"!"     |
"/"|"%"     |
"<<"|">>"   |
"<"|">"     |
"<="|">="   |
"=="|"!="   |
"^"|"|"     |
"&&"|"||"   |
"?"|":"     |
";"|"..."   |
"="|"*="    |
"/="|"%="   |
"+="|"-="   |
"<<="|">>=" |
"&="|"^="   |
"|="|","    |
"#"|"##"    |
"<:"|":>"   |
"<%"|"%>"   |
"%:"|"%:%:" TOK_PUNCTUATOR;

"/"(\\\n)*"/".*(\\\n.*)*

"/*"        BEGIN(COMMENT);
<COMMENT>{
    "*/"    BEGIN(INITIAL);
    <<EOF>> YY_FATAL_ERROR("Unterminated comment");
    .|\n
}

[[:blank:]\n]

.           YY_FATAL_ERROR("Unrecongized character");

%%

int main(int argc, char *argv[])
{
    yylex();
    return 0;
}
