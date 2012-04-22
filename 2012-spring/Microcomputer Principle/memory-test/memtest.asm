NAME "memtest"

; ��������������������
; ��һ�����ǵĹ����ǽ���������Ͳ��Դ���д������
; �ڶ��������������룬���������ж�ȡ���Դ�������ڴ�
; ���������ǲ��Դ��뱾��

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

    ; ��ʾ�û�����д��
    LEA DX, beginmsg
    MOV AH, 9
    INT 21h
    waitforkey
    
    ; ����������д��������������
    MOV AX, 0301h
    MOV CX, 0001h
    MOV DX, 0000h
    MOV BX, CS
    MOV ES, BX
    LEA BX, _bootcode
    INT 13h
    
    ; �����Դ���д������
    MOV AX, 0300h + codesects
    MOV CX, 0002h
    LEA BX, _code
    INT 13h
    
    ; �ȴ�����
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

; ��������

_bootcode:
    ; �����Դ���������м��ص�ָ��λ��
    MOV AX, 0200h + codesects
    MOV CX, 0002h
    MOV DH, 0
    MOV BX, codepos1
    MOV ES, BX
    XOR BX, BX
    INT 13h
    ; ��ת�����Դ���
    JMP codepos1:0

_bootcodeend:
    DB 510 - (_bootcodeend - _bootcode) DUP(90h)
    DW 0AA55h

; ���Դ��벿��

_code:

ORG 0h

_codestart:

    JMP _start

; ��������

; ����ϵͳ����

backupsys PROC
    PUSH DS
    PUSH ES
    PUSHA
    
    ; ���� DS��ES
    PUSH DS
    PUSH ES
    POP DS
    POP ES
    
    ; ����ϵͳ��Ϣ����������
    XOR SI, SI
    LEA DI, backup
    MOV CX, sysinfosize / 2
    REP MOVSW
    
    ; ���ݱ�־λ�Ĵ���
    PUSHF
    POP flagsbak
    ; �ر��ж���Ӧ
    CLI
    
    POPA
    POP ES
    POP DS
    RET
backupsys ENDP

; �ָ�ϵͳ����

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
    
    ; �ָ���־�Ĵ���
    PUSH flagsbak
    POPF
    RET
restoresys ENDP

; �������ƶ�������λ��

movecode PROC
    PUSH ES
    PUSHA
    
    ; ���ô����ƶ������ת����
    LEA BX, aftermoved
    MOV jmpcode[1], BL
    MOV jmpcode[2], BH
    MOV AX, DI
    MOV jmpcode[3], AL
    MOV jmpcode[4], AH

    ; �ƶ�����
    MOV ES, AX
    XOR DI, DI
    XOR SI, SI
    MOV CX, (_moveend - _codestart) / 2
    REP MOVSW
    
    ; ��ת���ƶ���� aftermoved
    jmpcode:
    JMP 1234h:5678h
    
    ; ���ø��ε��µ�λ��
    aftermoved:
    MOV AX, CS
    MOV DS, AX
    MOV SS, AX

    POPA
    POP ES
    RET
movecode ENDP

; �ж��ú�

; �ж��Ƿ�Ϊϵͳռ������
checksysseg MACRO addr, p
    LOCAL eom
    
    CMP addr, 0
    JNE eom
    CALL p

    eom:
checksysseg ENDM

; �ж��Ƿ���������
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

; �жϲ����Ƿ����
checkfinished MACRO addr, dest
    ADD addr, 1 << (blocksizeexp - 4)
    PUSH addr
    ; (addr << 4) >> 10 == addr >> 6
    SHR addr, 6
    CMP addr, memsize
    POP addr
    JB  dest
checkfinished ENDM

; ��ʾ��غ�

; �� AX �д洢������ת��Ϊ10���� ASCII
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

; �� AL �д洢������ת��Ϊ16���� ASCII
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
; �� AL �д洢������ת��Ϊ16���� ASCII
tohex2 MACRO dest
    tohex
    MOV dest[1], DL
    SHR AL, 4
    tohex
    MOV dest[0], DL
tohex2 ENDM
; �� AX �д洢������ת��Ϊ16���� ASCII
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

; ����ַ�������Ļ
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

; �����ѡ��ʾҳ
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

; ��ʾ���ִ���
showfail MACRO
    PUSHA

    INC rownum
    INC rownum
    writestr 010Ch, testfaillen, 0, rownum, testfail

    POPA
showfail ENDM

; ���浱ǰ���Ե����ڴ��ַ
savememory MACRO
    MOV memposh, BX
    MOV memposl, DI
savememory ENDM

; ��ʾ��ǰ�ڴ�λ��
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

; ��ʾһ��������
showpass MACRO
    PUSHA
    INC colnum
    writestr 010Fh, testoklen, colnum, rownum, testok
    POPA
showpass ENDM

; ��ʾ�������
displayallpass MACRO
    PUSHA
    INC rownum
    INC rownum
    writestr 010Ah, testpasslen, 0, rownum, testpass
    POPA
displayallpass ENDM

; ������

; �ȴ������������
waittoreboot MACRO attr
    INC rownum
    writestr attr, rebotmsglen, 0, rownum, rebotmsg
    waitforkey
    JMP 0FFFFh:0000h
waittoreboot ENDM

; ���Գ�����

; ��ַ������
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

        ; �õ�ַ���ֽ�����ڴ浥Ԫ
        XOR BX, BX
        MOV CX, blocksize
        loopadrfill1:
            MOV ES:[BX], BL
            INC BX
            LOOP loopadrfill1

        ; �������
        XOR BX, BX
        MOV CX, blocksize
        loopadrchk1:
            CMP ES:[BX], BL
            JNE testadrerror
            INC BX
            LOOP loopadrchk1
        
        ; �õ�ַ���ֽ�����ڴ浥Ԫ
        XOR BX, BX
        MOV CX, blocksize
        loopadrfill2:
            MOV ES:[BX], BH
            INC BX
            LOOP loopadrfill2

        ; �������
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
    
    ; �������
    testadrerror:
        checksysseg AX, restoresys
        ; ��ʾ������Ϣ
        MOV DI, BX
        MOV BX, AX
        savememory
        showfail
        showmemory
        waittoreboot 010Ch
addresstest ENDP

; ģʽ������
patterntest PROC
    PUSH ES
    PUSHA
    
    ; ��ʾ��ǰ��������
    INC rownum
    writestr 010Fh, patmsglen, 0, rownum, patmsg
    MOV colnum, CL

    XOR SI, SI
    
    looppat:
        ; ��ʾ��ǰ���Ե�ģʽ
        MOV AL, patterns[SI]
        tohex2 patstr
        INC colnum
        writestr 010Fh, patstrlen, colnum, rownum, patstr
        ADD colnum, CL

        ; ��ʼ��ģʽ
        XOR BX, BX
        MOV AL, patterns[SI]
        MOV AH, AL

        looppatmem:
            MOV ES, BX
            MOV DL, AL
            NOT DL
            
            checksysseg BX, backupsys
            checkcodeseg BX, codepos2
            
            ; ʹ��ģʽ��������ڴ浥Ԫ
            XOR DI, DI
            MOV CX, blocksize / 2
            REP STOSW
            
            ; ���ֽڲ���
            XOR DI, DI
            MOV CX, blocksize
            looppattest1:
                CMP AL, ES:[DI]
                JNE testpaterror
                MOV ES:[DI], DL
                INC DI
                LOOP looppattest1
            
            ; �������ֽڱȽ�
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
    
    ; �������
    testpaterror:
        checksysseg BX, restoresys
        ; ��ʾ������Ϣ
        savememory
        showfail
        tohex2 pathex
        INC rownum
        writestr 010Ch, patfaillen, 0, rownum, patfail
        showmemory
        ; ��ʾ����
        waittoreboot 010Ch
patterntest ENDP

; �ȴ�һ��ʱ��
waitfadetime PROC
    MOV AX, DS
    MOV ES, AX
    MOV BX, fadetime
    loopbitwait:
        ; ��ʾʣ��ʱ��
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
        ; ��ʱ1s
        MOV AH, 86h
        MOV CX, 1000000 >> 16
        MOV DX, 1000000 & 0FFFFh
        INT 15h
        ; ѭ��
        DEC BX
        JMP loopbitwait
    loopbitwaitend:
    MOV BX, bittimelen
    ADD colnum, BL
    RET
waitfadetime ENDP

; �������˲���
_bitfadetest MACRO pat
    LOCAL loopbitfillallmem, bitfillnextblock
    LOCAL loopbitchkallmem, loopbitchkblock, bitchknextblock
    LOCAL loopbitchkcodeseg

    ; �����׿�
    ; ��ʱ����ʹ��ϵͳ�жϣ��޷�����׿�
    MOV BX, blocksize / 10h
    ; ������������ڴ�����
    loopbitfillallmem:
        MOV ES, BX

        ; �����������ڿ飬��ͷ�ٴ˿�
        CMP BX, codepos1
        JE  bitfillnextblock
        ; ���
        MOV AL, pat
        XOR DI, DI
        MOV CX, blocksize
        REP STOSB

        bitfillnextblock:
        checkfinished BX, loopbitfillallmem

    CALL waitfadetime
    MOV BX, blocksize / 10h
    ; ��������ڴ�����
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

    ; �ƶ������
    MOV DI, codepos2
    CALL movecode
    ; ���������ڿ�
    MOV BX, codepos1
    MOV ES, BX
    MOV AL, pat
    XOR DI, DI
    MOV CX, blocksize
    REP STOSB

    CALL waitfadetime
    ; ���������ڿ�����
    MOV BX, codepos1
    MOV ES, BX
    XOR DI, DI
    MOV CX, blocksize
    loopbitchkcodeseg:
        CMP ES:[DI], pat
        JNE testbiterror
        INC DI
        LOOP loopbitchkcodeseg
    ; �ָ������
    MOV DI, codepos1
    CALL movecode
_bitfadetest ENDM

; �������˲���
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
    
    ; �������
    testbiterror:
        savememory
        showfail
        showmemory
        waittoreboot 010Ch
bitfadetest ENDP

_start:
    ; �������ݶκ�ջ
    MOV AX, CS
    MOV DS, AX
    MOV SS, AX
    LEA SP, stack + stacksize

    ; ��ȡ�ڴ��С
    INT 12h
    MOV memsize, AX

    ; ��ʾ���⻭��
    cleandisplay 0
    todec sizeend
    writestr 000Fh, startmsglen, 0, 0, startmsg
    MOV AX, 0500h
    INT 10h
    waitforkey

    cleandisplay 1
    MOV AX, 0501h
    INT 10h

    ; ��ʼ����
    CALL addresstest
    CALL patterntest
    CALL bitfadetest

    ; �������
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
