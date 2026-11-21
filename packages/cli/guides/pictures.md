# pictures: show the subject of the scene

A scene about a subject should show it. Neither source needs an image model.

**Illustrations**: `<Illustration name="ballot" color={accent} ink={ink} paper={background} size={290} delay={frame} />` from `motionrender/react` draws itself on (outline, then colour) in your palette. Names: server, phone, laptop, person, building, document, bars, globe, ballot, tree, shield, lock, coin, bolt, sun, panel, cloud, heart, bulb, truck. Pass `paper` the video's background so open shapes read as open. For a subject that is not in the set, draw your own SVG in the same flat style: a 6 px ink outline, round caps, one accent fill, `pathLength={1}` and a `strokeDashoffset` driven by `springValue`.

**Real photos and clips**: `mr stock "solar panels" --kind photo --aspect 9:16` (or `--kind video`) finds one on Pixabay with your own free `PIXABAY_API_KEY`, saves it under `assets/`, lists the credit in `assets/credits.json` and prints what to write. Declare the file in `config.assets` and use it by its id: `assets: [{ id: 'photo-22', type: 'image', src: 'assets/pixabay-22.jpg' }]`, then `<Img src="photo-22" />`. An undeclared picture renders as nothing. Show the credit on screen or in the description.

Use a real picture where the subject is a real place or thing (a coastline, a factory, a crowd); an illustration where it is an idea or a process (a vote, a cache, a handshake). Put a photo behind a cream or dark wash so text on it keeps its contrast, and keep pictures out of the platform bands of a 9:16 frame.
