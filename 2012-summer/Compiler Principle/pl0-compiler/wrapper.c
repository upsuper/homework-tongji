#include <stdio.h>

extern void asm_start(void);

int main(int argc, char *argv[])
{
    asm_start();
    return 0;
}

int input(void)
{
    int x;
    scanf("%d", &x);
    return x;
}

void output(int x)
{
    printf("%d\n", x);
}
