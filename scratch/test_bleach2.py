import bleach

html = '<div style="text-align: center; color: red;" align="center">Hello</div>'

cleaned = bleach.clean(html, tags=['div'], attributes={'div': ['style', 'align']})
print("Cleaned:", cleaned)
