NAME "memtest"

; 这个程序本身包含三个部分
; 第一部分是的功能是将引导代码和测试代码写入软盘
; 第二部分是引导代码，将从软盘中读取测试代码放入内存
; 第三部分是测试代码本体

blocksizeexp    EQU 13
blocksize       EQU (1 << blocksizeexp)
codepos1        EQU 200h
codepos2        EQU 400h
sysinfosize     EQU 500h
stacksize       EQU 200h
fadetime        EQU 5

codelen         EQU (_codeend - _codestart)
codesects       EQU ((codelen + 511) / 512)

newline         EQU 0dh, 0ah

waitforkey MACRO
    MOV AH, 0
    INT 16h
waitforkey ENDM

    ; 提示用户即将写入
    LEA DX, beginmsg
    MOV AH, 9
    INT 21h
    waitforkey
    
    ; 将引导代码写入软盘引导扇区
    MOV AX, 0301h
    MOV CX, 0001h
    MOV DX, 0000h
    MOV BX, CS
    MOV ES, BX
    LEA BX, _bootcode
    INT 13h
    
    ; 将测试代码写入软盘
    MOV AX, 0300h + codesects
    MOV CX, 0002h
    LEA BX, _code
    INT 13h
    
    ; 等待结束
    LEA DX, writemsg
    MOV AH, 9
    INT 21h
    waitforkey
    
    RET

beginmsg DB "Writing MemTest to floppy.", newline
         DB newline
         DB "Insert a floppy, ", newline
         DB "then press any key to continue.", newline, "$"
writemsg DB newline
         DB "Writen to disk.", newline
         DB "Press any key to exit.$"

; 引导代码

_bootcode:
    ; 将测试代码从软盘中加载到指定位置
    MOV AX, 0200h + codesects
    MOV CX, 0002h
    MOV DH, 0
    MOV BX, codepos1
    MOV ES, BX
    XOR BX, BX
    INT 13h
    ; 跳转到测试代码
    JMP codepos1:0

_bootcodeend:
    DB 510 - (_bootcodeend - _bootcode) DUP(90h)
    DW 0AA55h

; 测试代码部分

_code:

ORG 0h

_codestart:

    JMP _start

; 辅助过程

; 备份系统区域

backupsys PROC
    PUSH DS
    PUSH ES
    PUSHA
    
    ; 交换 DS、ES
    PUSH DS
    PUSH ES
    POP DS
    POP ES
    
    ; 复制系统信息到备份区域
    XOR SI, SI
    LEA DI, backup
    MOV CX, sysinfosize / 2
    REP MOVSW
    
    ; 备份标志位寄存器
    PUSHF
    POP flagsbak
    ; 关闭中断响应
    CLI
    
    POPA
    POP ES
    POP DS
    RET
backupsys ENDP

; 恢复系统区域

restoresys PROC
    PUSH DI
    PUSH SI
    PUSH CX
    
    XOR DI, DI
    LEA SI, backup
    MOV CX, sysinfosize / 2
    REP MOVSW
    
    POP CX
    POP SI
    POP DI
    
    ; 恢复标志寄存器
    PUSH flagsbak
    POPF
    RET
restoresys ENDP

; 将代码移动到其他位置

movecode PROC
    PUSH ES
    PUSHA
    
    ; 设置代码移动后的跳转代码
    LEA BX, aftermoved
    MOV jmpcode[1], BL
    MOV jmpcode[2], BH
    MOV AX, DI
    MOV jmpcode[3], AL
    MOV jmpcode[4], AH

    ; 移动代码
    MOV ES, AX
    XOR DI, DI
    XOR SI, SI
    MOV CX, (_moveend - _codestart) / 2
    REP MOVSW
    
    ; 跳转到移动后的 aftermoved
    jmpcode:
    JMP 1234h:5678h
    
    ; 设置各段到新的位置
    aftermoved:
    MOV AX, CS
    MOV DS, AX
    MOV SS, AX

    POPA
    POP ES
    RET
movecode ENDP

; 判断用宏

; 判断是否为系统占用区域
checksysseg MACRO addr, p
    LOCAL eom
    
    CMP addr, 0
    JNE eom
    CALL p

    eom:
checksysseg ENDM

; 判断是否包含代码段
checkcodeseg MACRO addr, dest
    LOCAL eom

    CMP addr, codepos1
    JNE eom
    PUSH DI
    MOV DI, dest
    CALL movecode
    POP DI

    eom:
checkcodeseg ENDM

; 判断测试是否完成
checkfinished MACRO addr, dest
    ADD addr, 1 << (blocksizeexp - 4)
    PUSH addr
    ; (addr << 4) >> 10 == addr >> 6
    SHR addr, 6
    CMP addr, memsize
    POP addr
    JB  dest
checkfinished ENDM

; 显示相关宏

; 将 AX 中存储的数字转换为10进制 ASCII
todec MACRO dest
    LOCAL loopdec
    
    LEA DI, dest
    MOV BL, 10
    loopdec:
        DEC DI
        DIV BL
        ADD AH, '0'
        MOV [DI], AH
        XOR AH, AH
        CMP AL, 0
        JNE loopdec
todec ENDM

; 将 AL 中存储的数字转换为16进制 ASCII
tohex MACRO
    LOCAL digit, final
    
    MOV DL, AL
    AND DL, 0Fh
    CMP DL, 10
    JNGE digit
    ADD DL, 'A' - 10
    JMP final
    digit:
    ADD DL, '0'
    final:
tohex ENDM
; 将 AL 中存储的数字转换为16进制 ASCII
tohex2 MACRO dest
    tohex
    MOV dest[1], DL
    SHR AL, 4
    tohex
    MOV dest[0], DL
tohex2 ENDM
; 将 AX 中存储的数字转换为16进制 ASCII
tohex4 MACRO dest
    tohex
    MOV dest[3], DL
    SHR AX, 4
    tohex
    MOV dest[2], DL
    SHR AX, 4
    tohex
    MOV dest[1], DL
    SHR AX, 4
    tohex
    MOV dest[0], DL
tohex4 ENDM

; 输出字符串到屏幕
writestr MACRO attr, len, col, row, off
    MOV AX, 1300h + 0001b
    MOV BX, attr
    MOV CX, len
    MOV DL, col
    MOV DH, row
    MOV DI, CS
    MOV ES, DI
    LEA BP, off
    INT 10h
writestr ENDM

; 清空所选显示页
cleandisplay MACRO page
    PUSH AX
    PUSH BX
    PUSH CX
    PUSH DI
    
    MOV BX, 0B800h + page * 100h
    MOV ES, BX
    XOR DI, DI
    XOR AX, AX
    MOV CX, 1000h
    REP STOSW
    
    POP DI
    POP CX
    POP BX
    POP AX
cleandisplay ENDM

; 显示发现错误
showfail MACRO
    PUSHA

    INC rownum
    INC rownum
    writestr 010Ch, testfaillen, 0, rownum, testfail

    POPA
showfail ENDM

; 保存当前测试到的内存地址
savememory MACRO
    MOV memposh, BX
    MOV memposl, DI
savememory ENDM

; 显示当前内存位置
showmemory MACRO
    PUSHA
    
    MOV AX, memposh
    tohex4 memhex
    MOV AX, memposl
    tohex4 memhex2
    
    INC rownum
    writestr 010Ch, memmsglen, 0, rownum, memmsg
    
    POPA
showmemory ENDM

; 显示一项测试完成
showpass MACRO
    PUSHA
    INC colnum
    writestr 010Fh, testoklen, colnum, rownum, testok
    POPA
showpass ENDM

; 显示测试完成
displayallpass MACRO
    PUSHA
    INC rownum
    INC rownum
    writestr 010Ah, testpasslen, 0, rownum, testpass
    POPA
displayallpass ENDM

; 其他宏

; 等待任意键后重启
waittoreboot MACRO attr
    INC rownum
    writestr attr, rebotmsglen, 0, rownum, rebotmsg
    waitforkey
    JMP 0FFFFh:0000h
waittoreboot ENDM

; 测试程序本体

; 地址填充测试
addresstest PROC
    PUSH ES
    PUSHA

    INC rownum
    writestr 010Fh, adrmsglen, 0, rownum, adrmsg
    MOV colnum, CL

    XOR AX, AX
    loopadrmem:
        MOV ES, AX

        checksysseg AX, backupsys
        checkcodeseg AX, codepos2

        ; 用地址低字节填充内存单元
        XOR BX, BX
        MOV CX, blocksize
        loopadrfill1:
            MOV ES:[BX], BL
            INC BX
            LOOP loopadrfill1

        ; 检查内容
        XOR BX, BX
        MOV CX, blocksize
        loopadrchk1:
            CMP ES:[BX], BL
            JNE testadrerror
            INC BX
            LOOP loopadrchk1
        
        ; 用地址高字节填充内存单元
        XOR BX, BX
        MOV CX, blocksize
        loopadrfill2:
            MOV ES:[BX], BH
            INC BX
            LOOP loopadrfill2

        ; 检查内容
        XOR BX, BX
        MOV CX, blocksize
        loopadrchk2:
            CMP ES:[BX], BH
            JNE testadrerror
            INC BX
            LOOP loopadrchk2

        checksysseg AX, restoresys
        checkcodeseg AX, codepos1

        checkfinished AX, loopadrmem

    showpass

    POPA
    POP ES
    RET
    
    ; 报告错误
    testadrerror:
        checksysseg AX, restoresys
        ; 显示错误信息
        MOV DI, BX
        MOV BX, AX
        savememory
        showfail
        showmemory
        waittoreboot 010Ch
addresstest ENDP

; 模式填充测试
patterntest PROC
    PUSH ES
    PUSHA
    
    ; 显示当前测试名称
    INC rownum
    writestr 010Fh, patmsglen, 0, rownum, patmsg
    MOV colnum, CL

    XOR SI, SI
    
    looppat:
        ; 显示当前测试的模式
        MOV AL, patterns[SI]
        tohex2 patstr
        INC colnum
        writestr 010Fh, patstrlen, colnum, rownum, patstr
        ADD colnum, CL

        ; 初始化模式
        XOR BX, BX
        MOV AL, patterns[SI]
        MOV AH, AL

        looppatmem:
            MOV ES, BX
            MOV DL, AL
            NOT DL
            
            checksysseg BX, backupsys
            checkcodeseg BX, codepos2
            
            ; 使用模式填充所有内存单元
            XOR DI, DI
            MOV CX, blocksize / 2
            REP STOSW
            
            ; 逐字节测试
            XOR DI, DI
            MOV CX, blocksize
            looppattest1:
                CMP AL, ES:[DI]
                JNE testpaterror
                MOV ES:[DI], DL
                INC DI
                LOOP looppattest1
            
            ; 反向逐字节比较
            MOV CX, blocksize
            looppattest2:
                DEC DI
                CMP DL, ES:[DI]
                JNE testpaterror
                MOV ES:[DI], AL
                LOOP looppattest2
            
            checksysseg BX, restoresys
            checkcodeseg BX, codepos1
            
            checkfinished BX, looppatmem
        
        INC SI
        CMP SI, patnum
        JNE looppat

    showpass

    POPA
    POP ES
    RET
    
    ; 报告错误
    testpaterror:
        checksysseg BX, restoresys
        ; 显示错误信息
        savememory
        showfail
        tohex2 pathex
        INC rownum
        writestr 010Ch, patfaillen, 0, rownum, patfail
        showmemory
        ; 显示重启
        waittoreboot 010Ch
patterntest ENDP

; 等待一段时间
waitfadetime PROC
    MOV AX, DS
    MOV ES, AX
    MOV BX, fadetime
    loopbitwait:
        ; 显示剩余时间
        MOV AL, ' '
        LEA DI, bittime
        MOV CX, OFFSET bittimesec - OFFSET bittime
        REP STOSB
        PUSH BX
        MOV AX, BX
        todec bittimesec
        writestr 010Fh, bittimelen, colnum, rownum, bittime
        POP BX
        CMP BX, 0
        JE  loopbitwaitend
        ; 延时1s
        MOV AH, 86h
        MOV CX, 1000000 >> 16
        MOV DX, 1000000 & 0FFFFh
        INT 15h
        ; 循环
        DEC BX
        JMP loopbitwait
    loopbitwaitend:
    MOV BX, bittimelen
    ADD colnum, BL
    RET
waitfadetime ENDP

; 内容消退测试
_bitfadetest MACRO pat
    LOCAL loopbitfillallmem, bitfillnextblock
    LOCAL loopbitchkallmem, loopbitchkblock, bitchknextblock
    LOCAL loopbitchkcodeseg

    ; 跳过首块
    ; 延时必须使用系统中断，无法检测首块
    MOV BX, blocksize / 10h
    ; 填充所有其他内存区域
    loopbitfillallmem:
        MOV ES, BX

        ; 跳过代码所在块，回头再此块
        CMP BX, codepos1
        JE  bitfillnextblock
        ; 填充
        MOV AL, pat
        XOR DI, DI
        MOV CX, blocksize
        REP STOSB

        bitfillnextblock:
        checkfinished BX, loopbitfillallmem

    CALL waitfadetime
    MOV BX, blocksize / 10h
    ; 检查所有内存区域
    loopbitchkallmem:
        MOV ES, BX
        
        CMP BX, codepos1
        JE  bitchknextblock
        
        XOR DI, DI
        MOV CX, blocksize
        loopbitchkblock:
            CMP ES:[DI], pat
            JNE testbiterror
            INC DI
            LOOP loopbitchkblock

        bitchknextblock:
        checkfinished BX, loopbitchkallmem

    ; 移动代码块
    MOV DI, codepos2
    CALL movecode
    ; 填充代码所在块
    MOV BX, codepos1
    MOV ES, BX
    MOV AL, pat
    XOR DI, DI
    MOV CX, blocksize
    REP STOSB

    CALL waitfadetime
    ; 检查代码所在块区域
    MOV BX, codepos1
    MOV ES, BX
    XOR DI, DI
    MOV CX, blocksize
    loopbitchkcodeseg:
        CMP ES:[DI], pat
        JNE testbiterror
        INC DI
        LOOP loopbitchkcodeseg
    ; 恢复代码块
    MOV DI, codepos1
    CALL movecode
_bitfadetest ENDM

; 内容消退测试
bitfadetest PROC
    PUSH ES
    PUSHA

    INC rownum
    writestr 010Fh, bitmsglen, 0, rownum, bitmsg
    MOV colnum, CL

    _bitfadetest 0FFh
    _bitfadetest 0
    showpass

    POPA
    POP ES
    RET
    
    ; 报告错误
    testbiterror:
        savememory
        showfail
        showmemory
        waittoreboot 010Ch
bitfadetest ENDP

_start:
    ; 设置数据段和栈
    MOV AX, CS
    MOV DS, AX
    MOV SS, AX
    LEA SP, stack + stacksize

    ; 获取内存大小
    INT 12h
    MOV memsize, AX

    ; 显示标题画面
    cleandisplay 0
    todec sizeend
    writestr 000Fh, startmsglen, 0, 0, startmsg
    MOV AX, 0500h
    INT 10h
    waitforkey

    cleandisplay 1
    MOV AX, 0501h
    INT 10h

    ; 开始测试
    CALL addresstest
    CALL patterntest
    CALL bitfadetest

    ; 测试完成
    displayallpass
    waittoreboot 010Ah

_data:
    memsize     DW 0
    flagsbak    DW 0
    colnum      DB 0
    rownum      DB -1

    startmsg    DB "Welcome to MemTest!", newline
                DB newline
                DB "Memory size:",
    sizedec     DB 5 DUP(' ')
    sizeend     DB "KB", newline
                DB "Press any key to start testing."
    startmsglen DW ($ - OFFSET startmsg)

    testok      DB "[OK]"
    testoklen   DW ($ - OFFSET testok)

    testpass    DB "All tests passed!"
    testpasslen DW ($ - OFFSET testpass)

    testfail    DB "Test failed!"
    testfaillen DW ($ - OFFSET testfail)

    rebotmsg    DB "Press any key to reboot."
    rebotmsglen DW ($ - OFFSET rebotmsg)

    memposh     DW 0
    memposl     DW 0
    memmsg      DB "Memory address: "
    memhex      DB 4 DUP('0'), ':'
    memhex2     DB 4 DUP('0')
    memmsglen   DW ($ - OFFSET memmsg)


    patnum      DW 18
    patterns    DB 1111_1111b, 0000_0000b, 1111_0000b, 0000_1111b
                DB 1100_1100b, 0011_0011b, 1001_1001b, 0110_0110b
                DB 1000_1000b, 0111_0111b, 0100_0100b, 1011_1011b
                DB 0010_0010b, 1101_1101b, 0001_0001b, 1110_1110b
                DB 1010_1010b, 0101_0101b
    patmsg      DB "Pattern tests:"
    patmsglen   DW ($ - OFFSET patmsg)
    patstr      DB "00"
    patstrlen   DW ($ - OFFSET patstr)
    patfail     DB "Pattern: 0x"
    pathex      DB "00"
    patfaillen  DW ($ - OFFSET patfail)
    
    adrmsg      DB "Address test:"
    adrmsglen   DW ($ - OFFSET adrmsg)
    
    bitmsg      DB "Bit Fade test:"
    bitmsglen   DW ($ - OFFSET bitmsg)
    bittime     DB "  "
    bittimesec  DB "s"
    bittimelen  DW ($ - OFFSET bittime)

_codeend:

    stack    DB stacksize DUP(0), 0

_moveend:

    backup   DB sysinfosize DUP(0)

_end:
