let container, qInput, qString;
let resourceName = GetParentResourceName();
let selected = {};
let adjust = {};

let cachedEffects = [];
let visibleEffects = [];
let effectLoadTimeout = null;
let favourites = {};
let activeTab = 'all';
const FAVORITES_KEY = 'eco_effect_favourites';
const COORDS_KEY = 'eco_effect_coords';
let selectedCoords = null;
let usePlayerFront = true;

function loadSavedCoords() {
    try {
        const saved = JSON.parse(localStorage.getItem(COORDS_KEY) || 'null');
        if (saved && !isNaN(saved.x) && !isNaN(saved.y) && !isNaN(saved.z)) {
            $('#fx_x').val(parseFloat(saved.x).toFixed(2));
            $('#fx_y').val(parseFloat(saved.y).toFixed(2));
            $('#fx_z').val(parseFloat(saved.z).toFixed(2));
            usePlayerFront = false;
        }
    } catch (e) {
        // ignore
    }
}

function saveCoords(x, y, z) {
    localStorage.setItem(COORDS_KEY, JSON.stringify({ x, y, z }));
}

function clearSavedCoords() {
    localStorage.removeItem(COORDS_KEY);
}


function effectKey(asset, name) {
    return `${asset}::${name}`;
}

function loadFavourites() {
    try {
        favourites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '{}') || {};
    } catch (e) {
        favourites = {};
    }
}

function getEffectPayload() {
    const payload = {
        asset: selected.asset,
        name: selected.name,
        usePlayerFront: usePlayerFront
    };

    if (!usePlayerFront) {
        const x = parseFloat($('#fx_x').val()) || 0;
        const y = parseFloat($('#fx_y').val()) || 0;
        const z = parseFloat($('#fx_z').val()) || 0;
        payload.coords = { x, y, z };
    }

    return payload;
}

function saveFavourites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favourites));
}

function isFavourite(asset, name) {
    return favourites[effectKey(asset, name)] === true;
}

function toggleFavourite(asset, name) {
    const key = effectKey(asset, name);
    if (favourites[key]) {
        delete favourites[key];
    } else {
        favourites[key] = true;
    }
    saveFavourites();
}

function updateTabButtons() {
    $('.tabBtn').removeClass('activeTab');
    if (activeTab === 'favourites') {
        $('#tab_favourites').addClass('activeTab');
    } else {
        $('#tab_all').addClass('activeTab');
    }
}

function buildCachedEffects() {
    cachedEffects = [];
    $.each(effects, function (asset, fxNameArray) {
        fxNameArray.forEach(name => {
            cachedEffects.push({ asset, name });
        });
    });
}

function lister() {
    container.empty();
    qString = qInput.val().toLowerCase();

    visibleEffects = [];
    updateTabButtons();

    $.each(effects, function (asset, fxNameArray) {
        let filtered = qString.length > 0
            ? fxNameArray.filter(c => c.toLowerCase().includes(qString))
            : fxNameArray;

        if (activeTab === 'favourites') {
            filtered = filtered.filter(name => isFavourite(asset, name));
        }

        if (filtered.length === 0) return;

        let $assetLink = $("<a/>", {
            text: asset,
            href: '#',
            class: `no_href`,
            click: function () {
                $(`.parent_${ asset }`).slideToggle(200);
                $(this).toggleClass('ulClose');
                return false;
            }
        }).appendTo(container);

        // Lista
        let $parent = $("<ul/>", {
            class: `parent_${ asset }`,
        }).appendTo(container);

        filtered.forEach(function (name) {
            visibleEffects.push({ asset, name });
            const favourited = isFavourite(asset, name);

            const $li = $("<li/>", {
                class: (selected.asset === asset && selected.name === name) ? 'act' : '',
            }).attr('data-asset', asset).attr('data-name', name);

            $("<span/>", {
                class: 'fx_name',
                text: name,
            }).appendTo($li);

            $("<span/>", {
                class: `fav_star ${favourited ? 'favourited' : ''}`,
                html: '&#9733;'
            }).appendTo($li).click(function (e) {
                e.preventDefault();
                e.stopPropagation();

                toggleFavourite(asset, name);
                lister();
            });

            $li.click(function () {
                $('li').removeClass('act');
                $(this).addClass('act');

                selected.asset = asset;
                selected.name = name;

                createClipboardData();

                $.post(`https://${resourceName}/showEffect`, JSON.stringify(getEffectPayload()));
            });

            $li.appendTo($parent);
        });
    });
}

function selectEffectByIndex(index) {
    if (visibleEffects.length === 0) return;

    if (index < 0) index = visibleEffects.length - 1;
    if (index >= visibleEffects.length) index = 0;

    selected = visibleEffects[index];

    $('li').removeClass('act');

    let $match = null;
    $('li').each(function () {
        if ($(this).attr('data-asset') === selected.asset && $(this).attr('data-name') === selected.name) {
            $match = $(this);
            return false;
        }
    });

    if ($match) {
        $match.addClass('act');

        let containerHeight = container.height();
        let containerScrollTop = container.scrollTop();
        let itemTop = $match.position().top;
        let itemHeight = $match.outerHeight();

        let newScrollTop = containerScrollTop + itemTop - (containerHeight / 2) + (itemHeight / 2);
        container.scrollTop(newScrollTop);
    }

    createClipboardData();

    if (effectLoadTimeout) {
        clearTimeout(effectLoadTimeout);
    }
    effectLoadTimeout = setTimeout(() => {
        $.post(`https://${resourceName}/showEffect`, JSON.stringify(getEffectPayload()));
        effectLoadTimeout = null;
    }, 250);
}

function getSelectedIndex() {
    for (let i = 0; i < visibleEffects.length; i++) {
        if (visibleEffects[i].asset === selected.asset && visibleEffects[i].name === selected.name) {
            return i;
        }
    }
    return -1;
}

window.addEventListener('message', function (event) {
    let item = event.data;

    if (item.subject === 'OPEN') {
        $('#wrapper').css("display", "block");
        $('#slider_container').css("display", "grid");

        qInput = $('#qInput');
        loadFavourites();
        loadSavedCoords();
        buildCachedEffects();
        lister();
    }
});

$(document).ready(function () {
    container = $('#list');

    $('#wrapper').draggable({ handle: '#header', containment: 'parent' });
    $('#slider_container').draggable();

    $('#sBtn').click(lister);
    $('#rBtn').click(function () {
        qInput.val('');
        lister();
    });

    $(document).keydown(function (e) {
        if ($('#wrapper').css('display') === 'none') return;

        if (e.which === 38 || e.which === 40) {
            e.preventDefault();

            let currentIndex = getSelectedIndex();
            if (currentIndex === -1 && visibleEffects.length > 0) {
                currentIndex = 0;
            } else {
                currentIndex += (e.which === 38) ? -1 : 1;

                if (currentIndex < 0) {
                    currentIndex = visibleEffects.length - 1;
                } else if (currentIndex >= visibleEffects.length) {
                    currentIndex = 0;
                }
            }
            selectEffectByIndex(currentIndex);
        } else if (e.which === 32) {
            e.preventDefault();

            if (selected.asset && selected.name) {
                $.post(`https://${resourceName}/showEffect`, JSON.stringify(getEffectPayload()));
            }
        }
    });

    $(document).keypress(function (e) {
        if (e.which === 101 && e.target.nodeName !== 'INPUT') {
            $.post(`https://${resourceName}/exit`);
        }
    });

    $('#tab_all').click(function () {
        activeTab = 'all';
        lister();
    });

    $('#tab_favourites').click(function () {
        activeTab = 'favourites';
        lister();
    });

    $('form').keypress(function (e) {
        if (e.which === 13) {
            e.preventDefault();
            lister();

            if (visibleEffects.length > 0) {
                selectEffectByIndex(0);
            }

            return false;
        }
    });

    $(document).keyup(function (e) {
        if (e.which === 27) close();
    });

    $('.btnClose').click(close);

    $('#day').click(function () {
        $.post(`https://${resourceName}/timeOfDay`, JSON.stringify({
            hour: 12
        }));
    });

    $('#night').click(function () {
        $.post(`https://${resourceName}/timeOfDay`, JSON.stringify({
            hour: 1
        }));
    });

    $('#get_coords_btn').click(function () {
        $.post(`https://${resourceName}/getPlayerCoords`, JSON.stringify({}), function (data) {
            if (data && data.x !== undefined && data.y !== undefined && data.z !== undefined) {
                const x = parseFloat(data.x).toFixed(2);
                const y = parseFloat(data.y).toFixed(2);
                const z = parseFloat(data.z).toFixed(2);
                $('#fx_x').val(x);
                $('#fx_y').val(y);
                $('#fx_z').val(z);
                usePlayerFront = false;
                saveCoords(x, y, z);
            }
        });
    });

    $('#use_forward_btn').click(function () {
        $('#fx_x').val('');
        $('#fx_y').val('');
        $('#fx_z').val('');
        usePlayerFront = true;
        clearSavedCoords();
    });

    $('#toggle_coords_btn').click(function () {
        const $coords = $('#coords_section');
        $coords.toggleClass('hidden');
        if ($coords.hasClass('hidden')) {
            $('#toggle_coords_btn').text('Show Coords');
        } else {
            $('#toggle_coords_btn').text('Hide Coords');
        }
    });

    let $fx_scale_v = $('#fx_scale_v');
    let $fx_r_v = $('#fx_r_v');
    let $fx_g_v = $('#fx_g_v');
    let $fx_b_v = $('#fx_b_v');
    let $fx_a_v = $('#fx_a_v');


    $.post(`https://${resourceName}/nuiSync`, {}, function (data) {

        adjust = data;

        $fx_scale_v.html(adjust.scale);
        $fx_r_v.html(adjust.r);
        $fx_g_v.html(adjust.g);
        $fx_b_v.html(adjust.b);
        $fx_a_v.html(adjust.a);

        $("#fx_scale").slider({
            min: 0.1,
            max: 5,
            step: 0.1,
            value: adjust.scale,
            change: function (event, ui) {

                adjust.scale = ui.value;
                createClipboardData();

                $.post(`https://${resourceName}/changeFx`, JSON.stringify({
                    name: 'scale',
                    value: adjust.scale
                }));
            },
            slide: function (event, ui) {
                $fx_scale_v.html(ui.value);
            }
        });

        $("#fx_r").slider({
            min: 0,
            max: 10,
            step: 0.1,
            value: adjust.r,
            change: function (event, ui) {

                adjust.r = ui.value;
                createClipboardData();

                $.post(`https://${resourceName}/changeFx`, JSON.stringify({
                    name: 'r',
                    value: adjust.r
                }));
            },
            slide: function (event, ui) {
                $fx_r_v.html(ui.value);
            }
        });

        $("#fx_g").slider({
            min: 0,
            max: 10,
            step: 0.1,
            value: adjust.g,
            change: function (event, ui) {

                adjust.g = ui.value;
                createClipboardData();

                $.post(`https://${resourceName}/changeFx`, JSON.stringify({
                    name: 'g',
                    value: adjust.g
                }));
            },
            slide: function (event, ui) {
                $fx_g_v.html(ui.value);
            }
        });

        $("#fx_b").slider({
            min: 0,
            max: 10,
            step: 0.1,
            value: adjust.b,
            change: function (event, ui) {

                adjust.b = ui.value;
                createClipboardData();

                $.post(`https://${resourceName}/changeFx`, JSON.stringify({
                    name: 'b',
                    value: adjust.b
                }));
            },
            slide: function (event, ui) {
                $fx_b_v.html(ui.value);
            }
        });

        $("#fx_a").slider({
            min: 0,
            max: 1,
            step: 0.1,
            value: adjust.a,
            change: function (event, ui) {

                adjust.a = ui.value;
                createClipboardData();

                $.post(`https://${resourceName}/changeFx`, JSON.stringify({
                    name: 'a',
                    value: adjust.a
                }));
            },
            slide: function (event, ui) {
                $fx_a_v.html(ui.value);
            }
        });
    });
});

function close() {
    $('#wrapper').css("display", "none");
    $('#slider_container').css("display", "none");
    $.post(`https://${resourceName}/exit`, JSON.stringify({
        stop: true
    }));
}

function createClipboardData() {
    let dScale = parseFloat(adjust.scale).toFixed(1);
    let dr = parseFloat(adjust.r).toFixed(1);
    let dg = parseFloat(adjust.g).toFixed(1);
    let db = parseFloat(adjust.b).toFixed(1);
    let da = parseFloat(adjust.a).toFixed(1);

    copyToClipboard(
        `
        FOR ECO_CRAFTING AND ECO_COLLECTING:
        dict = '${ selected.asset }', 
        name = '${ selected.name }',
        loopedAtCoord = { 0.0, 0.0, 0.0, ${ dScale } }, -- [xRot, yRot, zRot, scale]
        loopedColour = { ${ dr }, ${ dg }, ${ db } }, -- [r, g, b]
        
        NATIVE:
        scale = ${ dScale }
        --SetParticleFxLoopedColour(fx, ${ dr }, ${ dg }, ${ db }, 0),
        --SetParticleFxLoopedAlpha(fx, ${ da })
        `
    );
}

function copyToClipboard(string) {
    let $temp = $("<textarea>");
    $("body").append($temp);
    $temp.val(string).select();
    document.execCommand("copy");
    $temp.remove();
}
