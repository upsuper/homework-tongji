; 程序功能：在屏幕上绘制一幅图片

NAME "image"

ORG 100h

JMP start

msgwait  DB "Reading image from image.bin...$"
msgerror DB "Cannot read file image.bin!$"
msgcode  DB "Error code: "
hexcode  DB "0x", 4 dup(?), "$"
thanks   DB "Thanks for watching!", 0ah, 0dh
         DB "Press any key to exit...$"

size EQU 320 * 200

filename DB "image.bin", 0

start:

    MOV AX, 13h
    INT 10h                ; 将屏幕切换到图形模式

    MOV DX, OFFSET msgwait
    MOV AH, 9
    INT 21h                ; 显示等待信息
    crlf
    crlf

    MOV AX, 03D00h
    MOV DX, OFFSET filename
    INT 21h                ; 打开图片数据文件
    JC error

    PUSH DS
    MOV BX, 0A000h
    MOV DS, BX
    MOV BX, AX
    MOV AH, 03Fh
    MOV CX, size
    XOR DX, DX
    INT 21h                ; 直接读取图片数据到显存
    POP DS
    JC error

    MOV AH, 03Eh
    INT 21h                ; 关闭图片数据文件

exit:

    MOV AH, 0
    INT 16h                ; 暂停等待用户操作

    MOV AX, 03h
    INT 10h                ; 退回文字模式

    MOV DX, OFFSET thanks
    MOV AH, 9
    INT 21h

    MOV AH, 0
    INT 16h

    RET                    ; 返回

error:

    MOV DX, OFFSET msgerror
    MOV AH, 9
    INT 21h
    crlf

    MOV DX, OFFSET hexcode + 2
    CALL hex
    MOV DX, OFFSET msgcode
    MOV AH, 9
    INT 21h

    JMP exit

crlf MACRO

    MOV AH, 2
    MOV DL, 0Ah
    INT 21h
    MOV DL, 0Dh
    INT 21h

crlf ENDM

tohex MACRO n

    LOCAL num, ab, final

    CMP n, 10
    JL num
    JMP ab
    num:
        ADD n, '0'
        JMP final
    ab:
        ADD n, 'A' - 10
        JMP final
    final:
        MOV [DI], n
        INC DI

tohex ENDM

hex PROC

    PUSH BX
    PUSH DI

    MOV DI, DX

    MOV BL, AH
    SHR BL, 4
    tohex BL

    MOV BL, AH
    AND BL, 0Fh
    tohex BL

    MOV BL, AL
    SHR BL, 4
    tohex BL

    MOV BL, AL
    AND BL, 0Fh
    tohex BL

    POP DI
    POP BX
    RET

hex ENDP

END
