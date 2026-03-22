local active = false
local fx = 0
local activeFx = {}
local adjust = { scale = 1.0, r = 1.0, g = 3.0, b = 2.0, a = 1.0 }
local focusOnceKvp = 'eco_effect_focus_once'

local function openEffects(withFocus)
    SendNUIMessage({ subject = 'OPEN' })

    if not active then
        active = true

        DisableIdleCamera(true)
        SetPedCanPlayAmbientAnims(PlayerPedId(), false)

        CreateThread(function()
            while active do
                Wait(0)
                if IsControlJustReleased(0, 38) then
                    SetNuiFocus(true, true)
                end
            end
        end)
    end

    if withFocus then
        SetNuiFocus(true, true)
    end
end

RegisterCommand('effects', function()
    openEffects(false)
end)

RegisterNUICallback('nuiSync', function(data, cb)
    cb(adjust)
end)

RegisterNUICallback('showEffect', function(data, cb)
    if fx ~= 0 then
        stopEffect()
        Wait(100)
    end

    effectHandler(data)
    msginf('~g~Start effect: ' .. tostring(data.name), 2000)

    cb({ ok = true })
end)

RegisterNUICallback('stopAllEffects', function(data, cb)
    stopAllEffects()
    msginf("~r~Force stopping all effects", 1500);
    cb({ ok = true })
end)

RegisterNUICallback('exit', function(data, cb)
    SetNuiFocus(false, false)

    if data and data.stop then
        DisableIdleCamera(false)
        SetPedCanPlayAmbientAnims(PlayerPedId(), true)

        active = false
        stopEffect()
    end

    cb({ ok = true })
end)

RegisterNUICallback('timeOfDay', function(data, cb)
    local hour = tonumber(data and data.hour) or 12
    if hour < 0 then hour = 0 end
    if hour > 23 then hour = 23 end
    NetworkOverrideClockTime(hour, 0, 0)
    cb({ ok = true })
end)

RegisterNUICallback('getPlayerCoords', function(data, cb)
    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)
    cb({ x = pos.x, y = pos.y, z = pos.z })
end)

RegisterNUICallback('changeFx', function(data, cb)
    if fx ~= 0 and data and data.name ~= nil then
        local name = tostring(data.name)
        local value = tonumber(data.value) or 0.0

        if name == 'scale' then
            adjust.scale = value
            SetParticleFxLoopedScale(fx, adjust.scale + 0.0)
        elseif name == 'a' then
            adjust.a = value
            SetParticleFxLoopedAlpha(fx, adjust.a + 0.0)
        else
            if name == 'r' then adjust.r = value end
            if name == 'g' then adjust.g = value end
            if name == 'b' then adjust.b = value end
            SetParticleFxLoopedColour(fx, adjust.r + 0.0, adjust.g + 0.0, adjust.b + 0.0, 0)
        end
    end

    cb({ ok = true })
end)


function effectHandler(data)
    if not data or not data.asset or not data.name then
        msginf('Invalid effect data', 1500)
        return
    end

    local ped = PlayerPedId()
    local pos = GetEntityCoords(ped)

    local x, y, z
    if not data.usePlayerFront and data.coords and data.coords.x and data.coords.y and data.coords.z then
        x = tonumber(data.coords.x) or pos.x
        y = tonumber(data.coords.y) or pos.y
        z = tonumber(data.coords.z) or pos.z
    else
        local offset = GetEntityForwardVector(ped) * 6.0
        x = pos.x + offset.x
        y = pos.y + offset.y
        local _, groundZ = GetGroundZFor_3dCoord(x, y, pos.z, true)
        z = groundZ or pos.z
    end

    if not HasNamedPtfxAssetLoaded(data.asset) then
        RequestNamedPtfxAsset(data.asset)
        while not HasNamedPtfxAssetLoaded(data.asset) do
            Wait(0)
        end
    end

    SetPtfxAssetNextCall(data.asset)

    fx = StartParticleFxLoopedAtCoord(
            data.name,
            x, y, z,
            0.0, 0.0, 0.0,
            adjust.scale + 0.0,
            false, false, false, false
    )
    if fx ~= 0 then
        activeFx[fx] = true
    end
    SetParticleFxLoopedColour(fx, adjust.r + 0.0, adjust.g + 0.0, adjust.b + 0.0, 0)
    SetParticleFxLoopedAlpha(fx, adjust.a + 0.0)
end

function stopEffect()
    if fx ~= 0 then
        StopParticleFxLooped(fx, true)
        activeFx[fx] = nil
        fx = 0
        msginf('~r~stop effect', 1000)
    end
end

function stopAllEffects()
    for handle, _ in pairs(activeFx) do
        if handle ~= 0 then
            StopParticleFxLooped(handle, true)
        end
    end
    activeFx = {}
    fx = 0
    msginf('~r~stop all effects', 1000)
end

function msginf(msg, duree, color)
    duree = duree or 500

    local r, g, b = 255, 255, 255
    if color == 'red' then
        r, g, b = 255, 0, 0
    end

    ClearPrints()
    SetTextEntry_2("STRING")
    AddTextComponentString(tostring(msg))

    SetTextColour(r, g, b, 255)
    DrawSubtitleTimed(duree, 1)

    SetTextColour(255, 255, 255, 255)
end

RegisterNUICallback('loopMode', function(data, cb)
    if data and data.on then
        msginf('~r~Loop ON', 1000)
    else
        msginf('~b~Loop OFF', 1000)
    end
    cb({ ok = true })
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
    DisableIdleCamera(false)
    SetPedCanPlayAmbientAnims(PlayerPedId(), true)
    stopEffect()
end)

CreateThread(function()
    Wait(500)

    if GetResourceKvpInt(focusOnceKvp) == 1 then
        SetResourceKvpInt(focusOnceKvp, 0)
        openEffects(true)
    end
end)