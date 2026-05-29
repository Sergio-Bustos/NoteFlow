import bleach

html = '<div style="text-align: center; color: red;">Hello</div>'

try:
    from bleach.css_sanitizer import CSSSanitizer
    css_sanitizer = CSSSanitizer(allowed_css_properties=['text-align', 'color'])
    cleaned = bleach.clean(html, tags=['div'], attributes={'div': ['style']}, css_sanitizer=css_sanitizer)
    print("CSSSanitizer used:", cleaned)
except ImportError:
    cleaned = bleach.clean(html, tags=['div'], attributes={'div': ['style']}, styles=['text-align', 'color'])
    print("styles kwarg used:", cleaned)
