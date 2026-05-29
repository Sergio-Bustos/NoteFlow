import sys
import os
sys.path.append('/home/miniyon/NoteFlow')
from app import sanitizar_html

html1 = '<div style="text-align: center;">Centro estilo</div>'
html2 = '<div align="center">Centro align</div>'

print("HTML1:", sanitizar_html(html1))
print("HTML2:", sanitizar_html(html2))
