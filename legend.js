function keyDown() { return false; /* placeholder */ }
function keyUp()   { return false; /* placeholder */ }
function init() {
 document.onkeydown = top.keyDown;
 document.onkeyup   = top.keyUp;
}

<h3><font color="#000099" face="Verdana,Arial,Helvetica,Geneva" size=4 style="font-size:14pt" point-size=14
><b><i>JavaScript Tetris</i></b><br></font></h3>

<font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>
<b>Goal:</b> fill as many rows as possible!

<p>
<b>Control Keys</b><br>
<table border=0 cellpadding=1 cellspacing=1>
<tr>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>To move left</font></nobr></td>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>press <b>4</b> or &larr;</font></nobr></td>
</tr>

<tr>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>To move right</font></nobr></td>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>press <b>6</b> or &rarr;</font></nobr></td>
</tr>

<tr>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>To rotate</font></nobr></td>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>press <b>5</b> or <b>8</b> or &uarr;</font></nobr></td>
</tr>

<tr>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>To drop faster&nbsp;&nbsp;</font></nobr></td>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>press <b>space</b> or &darr;</font></nobr></td>
</tr>
</table>

<p>
<b>Mouse Control</b>
<table border=0 cellpadding=1 cellspacing=1>

<tr>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>To move left</font></nobr></td>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>click to the left of the piece</font></nobr></td>
</tr>

<tr>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>To move right</font></nobr></td>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>click to the right of the piece</font></nobr></td>
</tr>

<tr>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>To rotate</font></nobr></td>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>click on<code>/</code>above the piece</font></nobr></td>
</tr>

<tr>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>To drop faster&nbsp;&nbsp;</font></nobr></td>
<td><nobr><font face="Arial,Helvetica,Geneva" size=2 style="font-size:9pt" point-size=9>click below the piece</font></nobr></td>
</tr>
</table>

</font>
</body>
</html>
