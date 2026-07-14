// Variables globales
let SESSION_TOKEN = "";
let USER_PROFILE = null;
let AUX_DATA = {};
let ACTUAL_REGION_NACIONAL_ID = null;

async function ejecutarLogin() {
    const f = new FormData();
    f.append("email", document.getElementById("loginEmail").value);
    f.append("password", document.getElementById("loginPass").value);

    try {
        const r = await fetch("/auth/login", { method: "POST", body: f });
        const d = await r.json();
        if (d.error) return alert(d.error);

        SESSION_TOKEN = d.token;
        USER_PROFILE = d.perfil;
        
        document.getElementById("sectionLogin").classList.add("hidden");
        document.getElementById("sectionDashboard").classList.remove("hidden");
        document.getElementById("userInfo").classList.remove("hidden");
        document.getElementById("txtUserEmail").innerText = USER_PROFILE.email;
        document.getElementById("badgeRol").innerText = "ROL " + USER_PROFILE.rol;

        await precargarAuxiliares();
        aplicarPermisosPorRol();
    } catch (e) { alert("Error de servidor"); }
}

async function precargarAuxiliares() {
    try {
        const r = await fetch(`/data/auxiliar?token=${SESSION_TOKEN}`);
        if (!r.ok) throw new Error("Error obteniendo auxiliares");
        
        const data = await r.json();
        AUX_DATA = data;

        // 1. Poblar el selector de Revisiones/Versiones
        const selRev = document.getElementById("selRevision");
        const ordenRevisiones = [...AUX_DATA.revisiones].sort((a, b) => {
            if (a.estado === b.estado) return b.id - a.id;
            if (a.estado === "borrador") return -1;
            if (b.estado === "borrador") return 1;
            if (a.estado === "publicada") return -1;
            if (b.estado === "publicada") return 1;
            return b.id - a.id;
        });
        AUX_DATA.revisiones = ordenRevisiones;

        if (selRev) {
            selRev.innerHTML = "";
            ordenRevisiones.forEach(rv => {
                selRev.innerHTML += `<option value="${rv.id}">REV-${rv.numero_revision} (${rv.estado})</option>`;
            });

            const borradorAbierto = ordenRevisiones.find(r => r.estado === "borrador");
            const publicadaActiva = ordenRevisiones.find(r => r.estado === "publicada");
            if (borradorAbierto) {
                selRev.value = borradorAbierto.id;
            } else if (publicadaActiva) {
                selRev.value = publicadaActiva.id;
            }
        }

        const admNewRevCod = document.getElementById("admNewRevCod");
        if (admNewRevCod) {
            admNewRevCod.value = calcularProximaVersion(ordenRevisiones);
        }

        // 2. Construir los selectores matriciales cruzados (Columna A y B)
        const selA = document.getElementById("selColumnaA");
        const selB = document.getElementById("selColumnaB");
        const previousSelA = selA?.value;
        const previousSelB = selB?.value;
        const previousSelRev = selRev?.value;
        
        if (selA && selB) {
            if (USER_PROFILE && parseInt(USER_PROFILE.rol) === 1) {
                // Rol 1: Columna A es fija con la región asignada
                const regionAsignada = AUX_DATA.regiones.find(reg => reg.id == USER_PROFILE.region_asignada_id);
                if (regionAsignada) {
                    selA.innerHTML = `<option value="${regionAsignada.id}">${regionAsignada.nombre}</option>`;
                    selA.value = regionAsignada.id;
                }
                
                // Columna B: Ninguno o Nacional
                let htmlB = `<option value="none">-- Ninguno (Ver solo una columna) --</option>`;
                const nacional = AUX_DATA.regiones.find(reg => (reg.es_nacional === true || reg.es_nacional === "true") && reg.id != USER_PROFILE.region_asignada_id);
                if (nacional) {
                    htmlB += `<option value="${nacional.id}">${nacional.nombre}</option>`;
                }
                selB.innerHTML = htmlB;
            } else {
                // Demás roles: carga normal de todos los países y regiones
                let htmlOptions = "";
                AUX_DATA.paises.forEach(p => {
                    const regionesDelPais = AUX_DATA.regiones.filter(reg => reg.pais_id == p.id);
                    if (regionesDelPais.length > 0) {
                        htmlOptions += `<optgroup label="--- ${p.nombre.toUpperCase()} ---">`;
                        regionesDelPais.forEach(reg => {
                            htmlOptions += `<option value="${reg.id}">${reg.nombre}</option>`;
                        });
                        htmlOptions += `</optgroup>`;
                    }
                });

                selA.innerHTML = htmlOptions;
                selB.innerHTML = `<option value="none">-- Ninguno (Ver solo una columna) --</option>` + htmlOptions;
            }
        }

        if (selA && previousSelA) {
            const optionExists = [...selA.options].some(opt => opt.value === previousSelA);
            if (optionExists) selA.value = previousSelA;
        }
        if (selB && previousSelB) {
            const optionExists = [...selB.options].some(opt => opt.value === previousSelB);
            if (optionExists) selB.value = previousSelB;
        }
        if (selRev && previousSelRev) {
            const optionExists = [...selRev.options].some(opt => opt.value === previousSelRev);
            if (optionExists) selRev.value = previousSelRev;
        }

        // 3. CONTROL DE ROLES: Activar paneles de administración si es Rol 3, 4 o 5
        const panelAdmin = document.getElementById("panelAdmin"); 
        if (panelAdmin) {
            if (USER_PROFILE && [3, 4, 5].includes(parseInt(USER_PROFILE.rol))) {
                panelAdmin.classList.remove("hidden");
            } else {
                panelAdmin.classList.add("hidden");
            }
        }

        // 4. Poblar partidas en el editor de administración
        const selPartidasEdit = document.getElementById("admSelPartidaEdit");
        if (selPartidasEdit) {
            selPartidasEdit.innerHTML = '<option value="nueva">-- CREAR NUEVA PARTIDA --</option>';
            AUX_DATA.partidas.forEach(pt => {
                selPartidasEdit.innerHTML += `<option value="${pt.id}">${pt.descripcion.substring(0,40)}... (${pt.unidad})</option>`;
            });
        }

        // 5. NUEVO: Poblar ciudades para asignación de usuarios (Módulo Alta Usuarios)
        const admUserRegion = document.getElementById("admUserRegion");
        if (admUserRegion) {
            admUserRegion.innerHTML = '<option value="">-- Asignar Ciudad (Solo Nivel 1) --</option>';
            AUX_DATA.regiones.forEach(reg => {
                admUserRegion.innerHTML += `<option value="${reg.id}">${reg.nombre}</option>`;
            });
        }

        // 6. NUEVO: Poblar países para el creador de ciudades (Módulo Creador Ciudades)
        const admSelPaisCiudad = document.getElementById("admSelPaisCiudad");
        if (admSelPaisCiudad) {
            admSelPaisCiudad.innerHTML = '<option value="">-- Seleccione País Destino --</option>';
            AUX_DATA.paises.forEach(p => {
                admSelPaisCiudad.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
            });
        }
        
        // Dentro de precargarAuxiliares(), después de cargar los combos, añade:
        const checkboxes = ["chkPrecioNP", "chkPrecioOM1", "chkPrecioOM2"];
        checkboxes.forEach(id => {
            const cb = document.getElementById(id);
            if (cb) {
                cb.addEventListener("change", () => {
                    if (document.getElementById("tabContenidoEdicion") && !document.getElementById("tabContenidoEdicion").classList.contains("hidden")) {
                        cargarMatrizPreciosAdmin();
                    }
                });
            }
        });

        // 7. Aplicar permisos de rol después de cargar auxiliares
        aplicarPermisosPorRol();
    } catch (error) {
        console.error("Error en el flujo de inicialización:", error);
        alert("Ocurrió un inconveniente al cargar las regiones matriciales. Revisa la consola.");
    }
}

function solicitarVistaPreviaPdf() {
    console.log("Intentando cargar PDF...");
    const colA = document.getElementById("selColumnaA")?.value || "none";
    let colB = document.getElementById("selColumnaB")?.value;
    const rev = document.getElementById("selRevision")?.value;
    const mostrar_np = document.getElementById("chkPrecioNP").checked;
    const mostrar_om1 = document.getElementById("chkPrecioOM1").checked;
    const mostrar_om2 = document.getElementById("chkPrecioOM2").checked;
    const iframe = document.getElementById("pdfFrame");
    
    if (!rev) {
        alert("Por favor, asegúrese de contar con una revisión seleccionada.");
        return;
    }

    if (!mostrar_np && !mostrar_om1 && !mostrar_om2) {
        alert("Selecciona al menos un tipo de precio para mostrar en el PDF.");
        return;
    }
    
    if (colB === "none" || !colB) colB = "";

    const url = `/tabulador/ver-pdf?token=${SESSION_TOKEN}&col_a_id=${colA}&col_b_id=${colB}&revision_id=${rev}&mostrar_np=${mostrar_np}&mostrar_om1=${mostrar_om1}&mostrar_om2=${mostrar_om2}&_cb=${Date.now()}`;

    console.log("URL generada para el PDF:", url); 

    iframe.src = url;
}

function aplicarPermisosPorRol() {
    const perfil = USER_PROFILE;
    if (!perfil) return;

    const rol = parseInt(perfil.rol);
    const tabEdicion = document.getElementById("tabBtnEdicion");
    const tabAuditoria = document.getElementById("tabBtnAuditoria");
    const panelAdmin = document.getElementById("panelAdmin");
    const divAltaUsuarios = document.getElementById("divAltaUsuarios");
    const selectorColA = document.getElementById("selColumnaA");
    const selectorColB = document.getElementById("selColumnaB");
    const selectorRevision = document.getElementById("selRevision");

    // Ocultar elementos por defecto (solo se mostrarán si el rol lo permite)
    if (tabEdicion) tabEdicion.classList.add("hidden");
    if (tabAuditoria) tabAuditoria.classList.add("hidden");
    if (panelAdmin) panelAdmin.classList.add("hidden");
    if (divAltaUsuarios) divAltaUsuarios.classList.add("hidden");
    const btnBorrar = document.getElementById("btnBorrarPartida");
    if (btnBorrar) btnBorrar.classList.add("hidden");

    // Restablecer visibilidad de O&M por defecto
    document.getElementById("lblPrecioOM1")?.classList.remove("hidden");
    document.getElementById("lblPrecioOM2")?.classList.remove("hidden");

    // LÓGICA POR ROL
    if (rol === 1) {
        // Visualizador Regional: solo lectura, su ciudad es fija (bloqueada) y puede comparar con el precio nacional
        if (selectorColA) selectorColA.disabled = true;
        if (selectorColB) selectorColB.disabled = false;
        if (selectorRevision) selectorRevision.disabled = true;
        
        // Ocultar checkboxes de O&M para el Rol 1
        document.getElementById("lblPrecioOM1")?.classList.add("hidden");
        document.getElementById("lblPrecioOM2")?.classList.add("hidden");
        const chkOM1 = document.getElementById("chkPrecioOM1");
        if (chkOM1) chkOM1.checked = false;
        const chkOM2 = document.getElementById("chkPrecioOM2");
        if (chkOM2) chkOM2.checked = false;
        
        cambiarTab('vista');
    } 
    else if (rol === 2) {
        // Visualizador General: solo lectura, puede cambiar filtros
        if (selectorColA) selectorColA.disabled = false;
        if (selectorColB) selectorColB.disabled = false;
        if (selectorRevision) selectorRevision.disabled = false;
        cambiarTab('vista');
    }
    else if (rol === 3 || rol === 5) {
        // Gerentes (Nuevos Proyectos u O&M): pueden editar con restricciones e interactuar con el panel admin (excepto usuarios)
        if (tabEdicion) tabEdicion.classList.remove("hidden");
        if (panelAdmin) panelAdmin.classList.remove("hidden");
        if (tabAuditoria) tabAuditoria.classList.add("hidden");
        
        // Habilitar selectores para que puedan elegir qué comparar
        if (selectorColA) selectorColA.disabled = false;
        if (selectorColB) selectorColB.disabled = false;
        if (selectorRevision) selectorRevision.disabled = false;
        cambiarTab('edicion');
    }
    else if (rol === 4) {
        // Súper Administrador: acceso total
        if (tabEdicion) tabEdicion.classList.remove("hidden");
        if (tabAuditoria) tabAuditoria.classList.remove("hidden");
        if (panelAdmin) panelAdmin.classList.remove("hidden");
        if (divAltaUsuarios) divAltaUsuarios.classList.remove("hidden");
        if (selectorColA) selectorColA.disabled = false;
        if (selectorColB) selectorColB.disabled = false;
        if (selectorRevision) selectorRevision.disabled = false;
        cambiarTab('vista');
    }
}

function calcularProximaVersion(revisiones) {
    if (!revisiones || revisiones.length === 0) return "";
    const publicadas = revisiones.filter(r => r.estado === "publicada");
    const baseRevision = publicadas.length ? publicadas[0] : revisiones.find(r => r.estado !== "archivada") || revisiones[0];
    const latest = baseRevision?.numero_revision || "";
    const match = latest.match(/(\d+)$/);
    if (!match) return "";
    const numero = parseInt(match[1], 10);
    if (Number.isNaN(numero)) return "";
    const padded = match[1].length;
    return String(numero + 1).padStart(padded, "0");
}

function cambiarTab(tab) {
    const vistas = ["Vista", "Edicion", "Auditoria"];
    vistas.forEach(v => {
        document.getElementById(`tabContenido${v}`).classList.add("hidden");
        document.getElementById(`tabBtn${v}`).classList.remove("bg-gray-700");
    });

    if (tab === 'vista') {
        document.getElementById("tabContenidoVista").classList.remove("hidden");
        document.getElementById("tabBtnVista").classList.add("bg-gray-700");
    } else if (tab === 'edicion') {
        document.getElementById("tabContenidoEdicion").classList.remove("hidden");
        document.getElementById("tabBtnEdicion").classList.add("bg-gray-700");
        cargarMatrizPreciosAdmin();
    } else if (tab === 'auditoria') {
        document.getElementById("tabContenidoAuditoria").classList.remove("hidden");
        document.getElementById("tabBtnAuditoria").classList.add("bg-gray-700");
        cargarFechasAuditoria();
    }
}

async function cargarMatrizPreciosAdmin() {
    const rev = document.getElementById("selRevision").value;
    const selectorColA = document.getElementById("selColumnaA");
    const selectorColB = document.getElementById("selColumnaB");
    
    let regA = selectorColA.value;
    let regB = selectorColB.value;

    if ((!regA || regA === "none") && (!regB || regB === "none")) {
        alert("Debes seleccionar al menos una región válida.");
        return;
    }
    if (!rev) {
        alert("Selecciona una revisión.");
        return;
    }

    const rolActual = parseInt(USER_PROFILE.rol);
    let mostrarNP = false, mostrarOM1 = false, mostrarOM2 = false;
    if (rolActual === 4) {
        mostrarNP = document.getElementById("chkPrecioNP").checked;
        mostrarOM1 = document.getElementById("chkPrecioOM1").checked;
        mostrarOM2 = document.getElementById("chkPrecioOM2").checked;
    } else if (rolActual === 3) {
        mostrarNP = true;
        mostrarOM1 = false;
        mostrarOM2 = false;
    } else if (rolActual === 5) {
        mostrarNP = false;
        mostrarOM1 = true;
        mostrarOM2 = true;
    } else {
        cambiarTab('vista');
        return;
    }

    if (!mostrarNP && !mostrarOM1 && !mostrarOM2) {
        alert("No hay tipos de precio habilitados para tu rol.");
        return;
    }

    // Nombres de regiones para NP
    let nombreA = "", nombreB = "";
    if (regA && regA !== "none") nombreA = selectorColA.options[selectorColA.selectedIndex]?.text || "Región A";
    else regA = null;
    if (regB && regB !== "none") nombreB = selectorColB.options[selectorColB.selectedIndex]?.text || "Región B";
    else regB = null;

    // Cargar precios NP (regionales) y O&M globales
    let preciosRegionA = {};
    let preciosRegionB = {};
    let preciosOM = { om1: {}, om2: {} };

    // Obtener datos de la matriz (incluye precios_om)
    if (regA) {
        const resp = await fetch(`/admin/precios/matriz?token=${SESSION_TOKEN}&revision_id=${rev}&region_id=${regA}`);
        if (resp.ok) {
            const data = await resp.json();
            data.regionales.forEach(p => preciosRegionA[p.partida_id] = p.monto_usd || 0);
            // Obtener O&M de la misma llamada (son los mismos para todas las regiones)
            if (data.precios_om) {
                Object.keys(data.precios_om).forEach(partidaId => {
                    preciosOM.om1[partidaId] = data.precios_om[partidaId].om1 || 0;
                    preciosOM.om2[partidaId] = data.precios_om[partidaId].om2 || 0;
                });
            }
        }
    }
    if (regB && regB !== regA) {
        const resp = await fetch(`/admin/precios/matriz?token=${SESSION_TOKEN}&revision_id=${rev}&region_id=${regB}`);
        if (resp.ok) {
            const data = await resp.json();
            data.regionales.forEach(p => preciosRegionB[p.partida_id] = p.monto_usd || 0);
        }
    }
    // Si no se cargó O&M todavía, hacer una petición específica (opcional)
    if (Object.keys(preciosOM.om1).length === 0) {
        const respOM = await fetch(`/admin/precios/om?token=${SESSION_TOKEN}&revision_id=${rev}`);
        if (respOM.ok) {
            const data = await respOM.json();
            data.precios.forEach(p => {
                preciosOM.om1[p.partida_id] = p.monto_om_1 || 0;
                preciosOM.om2[p.partida_id] = p.monto_om_2 || 0;
            });
        }
    }

    // Construir encabezado
    let theadHTML = `<thead class="bg-gray-900 sticky top-0 text-gray-400 uppercase"><tr><th class="p-3">Partida</th><th class="p-3">Unidad</th>`;
    if (mostrarNP) {
        if (regA) theadHTML += `<th class="p-3 text-center">${nombreA} (NP)</th>`;
        if (regB) theadHTML += `<th class="p-3 text-center">${nombreB} (NP)</th>`;
    }
    if (mostrarOM1) theadHTML += `<th class="p-3 text-center">O&M 1</th>`;
    if (mostrarOM2) theadHTML += `<th class="p-3 text-center">O&M 2</th>`;
    theadHTML += `<th class="p-3 text-center">Acción</th></tr></thead>`;

    const tbody = document.getElementById("tbodyMatriz");
    const tabla = tbody.closest("table");
    tabla.innerHTML = theadHTML + "<tbody id='tbodyMatriz'></tbody>";
    const nuevoTbody = document.getElementById("tbodyMatriz");

    // Recorrer partidas
    AUX_DATA.partidas.forEach(pt => {
        let row = `<tr class="hover:bg-gray-800 fila-precio-matriz" data-partida-id="${pt.id}" data-categoria-id="${pt.categoria_id}">
            <td class="p-3">${pt.descripcion}</td>
            <td class="p-3"><span class="bg-emerald-900/50 text-emerald-400 px-1.5 py-0.5 rounded text-[10px]">${pt.unidad}</span></td>`;

        if (mostrarNP) {
            if (regA) row += `<td class="p-3"><input type="number" step="0.01" value="${preciosRegionA[pt.id] || 0}" data-partida="${pt.id}" data-tipo="np" data-region="${regA}" class="w-full bg-gray-900 border border-emerald-700 rounded p-1 text-white text-center input-precio"></td>`;
            if (regB) row += `<td class="p-3"><input type="number" step="0.01" value="${preciosRegionB[pt.id] || 0}" data-partida="${pt.id}" data-tipo="np" data-region="${regB}" class="w-full bg-gray-900 border border-emerald-700 rounded p-1 text-white text-center input-precio"></td>`;
        }
        if (mostrarOM1) {
            row += `<td class="p-3"><input type="number" step="0.01" value="${preciosOM.om1[pt.id] || 0}" data-partida="${pt.id}" data-tipo="om1" class="w-full bg-gray-900 border border-amber-700 rounded p-1 text-white text-center input-precio"></td>`;
        }
        if (mostrarOM2) {
            row += `<td class="p-3"><input type="number" step="0.01" value="${preciosOM.om2[pt.id] || 0}" data-partida="${pt.id}" data-tipo="om2" class="w-full bg-gray-900 border border-indigo-700 rounded p-1 text-white text-center input-precio"></td>`;
        }

        row += `<td class="p-3 text-center"><button onclick="guardarPrecioCelda(event, ${pt.id})" class="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-bold">Guardar</button></td></tr>`;
        nuevoTbody.innerHTML += row;
    });
}

async function guardarPrecioCelda(event, partidaId) {
    const rev = document.getElementById("selRevision").value;
    if (!rev) { alert("No hay revisión."); return; }

    const rolActual = parseInt(USER_PROFILE.rol);
    const fila = event?.target?.closest('tr') || document.querySelector(`tr[data-partida-id="${partidaId}"]`);
    if (!fila) return;

    const inputs = fila.querySelectorAll('input[data-partida]');
    const updatesNP = [];    // para NP
    const updatesOM = { om1: null, om2: null }; // solo uno de cada tipo

    inputs.forEach(input => {
        const tipo = input.getAttribute('data-tipo');
        const regionId = input.getAttribute('data-region');
        const valor = parseFloat(input.value) || 0;

        if (rolActual === 3 && tipo !== 'np') return;
        if (rolActual === 5 && tipo === 'np') return;

        if (tipo === 'np' && regionId) {
            updatesNP.push({ region_id: regionId, monto_usd: valor });
        } else if (tipo === 'om1') {
            updatesOM.om1 = valor;
        } else if (tipo === 'om2') {
            updatesOM.om2 = valor;
        }
    });

    if (updatesNP.length === 0 && updatesOM.om1 === null && updatesOM.om2 === null) {
        alert("No tienes permiso o no hay datos para guardar.");
        return;
    }

    const btn = event?.target?.tagName === 'BUTTON' ? event.target : fila.querySelector('button');
    const textoOriginal = btn.innerText;
    btn.innerText = "Guardando...";
    btn.disabled = true;

    try {
        // Guardar NP (cada región por separado)
        for (const upd of updatesNP) {
            const formData = new FormData();
            formData.append("revision_id", rev);
            formData.append("partida_id", partidaId);
            formData.append("region_id", upd.region_id);
            formData.append("monto_usd", upd.monto_usd);
            formData.append("monto_om_1", 0);
            formData.append("monto_om_2", 0);
            const resp = await fetch(`/admin/precios/guardar?token=${SESSION_TOKEN}`, { method: "POST", body: formData });
            if (!resp.ok) throw new Error(await resp.text());
        }

        // Guardar O&M (global, una sola vez por partida)
        if (updatesOM.om1 !== null || updatesOM.om2 !== null) {
            const formDataOM = new FormData();
            formDataOM.append("revision_id", rev);
            formDataOM.append("partida_id", partidaId);
            formDataOM.append("monto_om_1", updatesOM.om1 !== null ? updatesOM.om1 : 0);
            formDataOM.append("monto_om_2", updatesOM.om2 !== null ? updatesOM.om2 : 0);
            const resp = await fetch(`/admin/precios/om/guardar?token=${SESSION_TOKEN}`, { method: "POST", body: formDataOM });
            if (!resp.ok) throw new Error(await resp.text());
        }

        btn.innerText = "¡Guardado!";
        btn.classList.replace("bg-amber-600", "bg-green-600");
        setTimeout(() => {
            btn.innerText = textoOriginal;
            btn.classList.replace("bg-green-600", "bg-amber-600");
            btn.disabled = false;
        }, 1500);
    } catch (error) {
        alert("Error al guardar: " + error.message);
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
}

function toggleUserRegion() {
    const rol = document.getElementById("admUserRol").value;
    const reg = document.getElementById("admUserRegion");
    reg.disabled = (rol !== "1");
    if (rol !== "1") reg.value = ""; 
}

async function crearUsuario() {
    const rol = parseInt(document.getElementById("admUserRol").value);
    const region = document.getElementById("admUserRegion").value;
    
    if (rol === 1 && !region) {
        return alert("Para el Nivel 1 debes asignar obligatoriamente una Ciudad.");
    }

    const u = {
        email: document.getElementById("admUserEmail").value,
        password: document.getElementById("admUserPass").value,
        rol: rol,
        region_asignada_id: rol === 1 ? parseInt(region) : null
    };

    const r = await fetch(`/admin/usuarios?token=${SESSION_TOKEN}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(u)
    });
    
    const d = await r.json();
    alert(d.status || d.detail);
    document.getElementById("admUserEmail").value = "";
    document.getElementById("admUserPass").value = "";
}

function cargarDatosPartidaParaEdicion() {
    const partidaId = document.getElementById("admSelPartidaEdit").value;
    const btn = document.getElementById("btnGuardarPartida");
    const btnBorrar = document.getElementById("btnBorrarPartida");
    
    if (partidaId === "nueva") {
        document.getElementById("admPartDesc").value = "";
        document.getElementById("admPartUd").value = "";
        btn.innerText = "Crear Nueva Partida";
        btn.classList.replace("bg-indigo-600", "bg-amber-600");
        if (btnBorrar) btnBorrar.classList.add("hidden");
    } else {
        const p = AUX_DATA.partidas.find(x => x.id == partidaId);
        if (!p) {
            document.getElementById("admPartDesc").value = "";
            document.getElementById("admPartUd").value = "";
            btn.innerText = "Crear Nueva Partida";
            btn.classList.replace("bg-indigo-600", "bg-amber-600");
            if (btnBorrar) btnBorrar.classList.add("hidden");
            return;
        }
        document.getElementById("admPartCat").value = p.categoria_id;
        document.getElementById("admPartDesc").value = p.descripcion;
        document.getElementById("admPartUd").value = p.unidad;
        btn.innerText = "Actualizar Partida Existente";
        btn.classList.replace("bg-amber-600", "bg-indigo-600");
        
        // Mostrar botón de borrar solo si el usuario es Rol 4
        if (btnBorrar) {
            if (USER_PROFILE && parseInt(USER_PROFILE.rol) === 4) {
                btnBorrar.classList.remove("hidden");
            } else {
                btnBorrar.classList.add("hidden");
            }
        }
    }
}

async function guardarPartida() {
    const partidaId = document.getElementById("admSelPartidaEdit").value;
    const p = {
        categoria_id: parseInt(document.getElementById("admPartCat").value),
        descripcion: document.getElementById("admPartDesc").value,
        unidad: document.getElementById("admPartUd").value
    };

    let url = `/admin/partidas?token=${SESSION_TOKEN}`;
    let method = "POST";

    if (partidaId !== "nueva") {
        url = `/admin/partidas/${partidaId}?token=${SESSION_TOKEN}`;
        method = "PUT";
    }

    await fetch(url, { method: method, headers: {"Content-Type": "application/json"}, body: JSON.stringify(p) });
    alert(partidaId === "nueva" ? "Partida Creada" : "Partida Actualizada");
    precargarAuxiliares();
}

async function crearPais() {
    const f = new FormData(); 
    f.append("nombre", document.getElementById("admNewPais").value);
    await fetch(`/admin/paises?token=${SESSION_TOKEN}`, { method: "POST", body: f });
    alert("País Creado"); 
    precargarAuxiliares();
}

async function crearCiudad() {
    const f = new FormData(); 
    f.append("pais_id", document.getElementById("admSelPaisCiudad").value);
    f.append("nombre", document.getElementById("admNewCiudad").value);
    await fetch(`/admin/regiones?token=${SESSION_TOKEN}`, { method: "POST", body: f });
    alert("Ciudad Creada"); 
    precargarAuxiliares();
}

async function crearNuevoBorrador() {
    try {
        const response = await fetch(`/admin/revisiones/crear-borrador?token=${SESSION_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        if (response.ok) {
            alert(`Revisión ${data.nueva_version} creada con éxito.`);
            await precargarAuxiliares();
            const selRev = document.getElementById("selRevision");
            if (selRev && data.nueva_version) {
                const opcion = [...selRev.options].find(opt => opt.text.includes(`REV-${data.nueva_version}`));
                if (opcion) selRev.value = opcion.value;
            }
            aplicarPermisosPorRol();
        } else {
            alert("Error: " + (data.detail || data.error || JSON.stringify(data)));
        }
    } catch (error) {
        console.error("Error al crear borrador:", error);
        alert("Error de red al crear borrador. Revisa la consola.");
    }
}

async function publicarBorradorActual() {
    const f = new FormData(); 
    f.append("revision_id", document.getElementById("selRevision").value);
    const r = await fetch(`/admin/revisiones/publicar?token=${SESSION_TOKEN}`, { method: "POST", body: f });
    const d = await r.json();
    alert(d.status || d.detail);
    await precargarAuxiliares();
    aplicarPermisosPorRol();
}

async function cancelarBorradorActual() {
    const f = new FormData();
    f.append("revision_id", document.getElementById("selRevision").value);
    const r = await fetch(`/admin/revisiones/cancelar-borrador?token=${SESSION_TOKEN}`, { method: "POST", body: f });
    const d = await r.json();
    alert(d.status || d.detail);
    await precargarAuxiliares();
    aplicarPermisosPorRol();
}

function logout() { 
    window.location.reload(); 
}

async function cargarFechasAuditoria() {
    try {
        const res = await fetch(`/admin/auditoria/fechas?token=${SESSION_TOKEN}`);
        const data = await res.json();
        
        const sel = document.getElementById("selFechaAuditoria");
        sel.innerHTML = "";
        
        if (!data.fechas || data.fechas.length === 0) {
            sel.innerHTML = '<option value="">No hay historial registrado</option>';
            return;
        }

        data.fechas.forEach(f => {
            const partes = f.split("-");
            const formatoLimpio = `${partes[2]}/${partes[1]}/${partes[0]}`;
            sel.innerHTML += `<option value="${f}">${formatoLimpio}</option>`;
        });

        cargarAuditoriaPorFecha();
    } catch (e) {
        console.error("Error cargando fechas de auditoría", e);
    }
}

async function cargarAuditoriaPorFecha() {
    const fecha = document.getElementById("selFechaAuditoria").value;
    if (!fecha) return;

    const tbody = document.getElementById("tbodyAuditoria");
    tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-amber-500">Cargando datos...</td></tr>';

    try {
        const res = await fetch(`/admin/auditoria/por-dia?fecha=${fecha}&token=${SESSION_TOKEN}`);
        const data = await res.json();

        tbody.innerHTML = "";
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">No hay movimientos en este día.</td></tr>';
            return;
        }

        data.forEach(log => {
            const dateObj = new Date(log.fecha_hora);
            const horaStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            let badgeColor = "bg-gray-700 text-gray-300";
            if (log.accion === "CREAR") badgeColor = "bg-emerald-900/50 text-emerald-400 border-emerald-500/30";
            if (log.accion === "MODIFICAR") badgeColor = "bg-amber-900/50 text-amber-400 border-amber-500/30";
            if (log.accion === "ELIMINAR") badgeColor = "bg-red-900/50 text-red-400 border-red-500/30";

            tbody.innerHTML += `
                <tr class="hover:bg-gray-800 transition-colors">
                    <td class="p-3 text-center text-gray-400 font-mono">${horaStr}</td>
                    <td class="p-3 font-semibold text-gray-200">${log.usuario_nombre}</td>
                    <td class="p-3 text-gray-400 capitalize">${log.modulo}</td>
                    <td class="p-3 text-center">
                        <span class="border px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}">${log.accion}</span>
                    </td>
                    <td class="p-3 text-gray-300">${log.descripcion}</td>
                </tr>
            `;
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500">Error al consultar el historial.</td></tr>';
    }
}




async function guardarPreciosAdmin() {
    const rev = document.getElementById("selRevision").value;
    const regA = document.getElementById("selColumnaA").value;
    const regB = document.getElementById("selColumnaB").value;
    
    if (!rev) {
        alert("No hay revisión seleccionada.");
        return;
    }

    const rolActual = parseInt(USER_PROFILE.rol);
    const esGerenteNP = (rolActual === 3);
    const esGerenteOM = (rolActual === 5);
    
    // Colección de promesas de guardado
    let promesas = [];

    // Recorrer todas las filas de la tabla de edición
    const filas = document.querySelectorAll("#tbodyMatriz tr.fila-precio-matriz");
    for (const fila of filas) {
        const partidaId = parseInt(fila.getAttribute("data-partida-id"));
        const categoriaId = parseInt(fila.getAttribute("data-categoria-id"));
        
        // Determinar si esta partida es de Nuevos Proyectos (NP) o de O&M
        const esNP = (categoriaId === 1);      
        const esOM = (categoriaId === 2 || categoriaId === 3); 

        // Filtrar según rol
        if (esGerenteNP && esOM) continue;      // Gerente NP no guarda O&M
        if (esGerenteOM && esNP) continue;      // Gerente O&M no guarda NP

        // Recolectar valores de inputs
        let updates = [];
        if (regA !== "none") {
            const inputA = fila.querySelector(`input[id^="inColA_${partidaId}"]`);
            if (inputA) {
                updates.push({
                    region_id: regA,
                    monto_usd: parseFloat(inputA.value) || 0
                });
            }
        }
        if (regB !== "none") {
            const inputB = fila.querySelector(`input[id^="inColB_${partidaId}"]`);
            if (inputB) {
                updates.push({
                    region_id: regB,
                    monto_usd: parseFloat(inputB.value) || 0
                });
            }
        }

        // Crear los fetch para cada actualización válida
        updates.forEach(u => {
            const form = new FormData();
            form.append("revision_id", rev);
            form.append("partida_id", partidaId);
            form.append("region_id", u.region_id);
            form.append("monto_usd", u.monto_usd);

            const promesa = fetch(`/admin/precios/guardar?token=${SESSION_TOKEN}`, {
                method: "POST",
                body: form
            });
            promesas.push(promesa);
        });
    }

    if (promesas.length === 0) {
        alert("No hay datos nuevos permitidos para guardar según tu rol.");
        return;
    }

    try {
        await Promise.all(promesas);
        alert("Precios guardados correctamente.");
    } catch (e) {
        alert("Hubo un error al guardar algunos precios.");
        console.error(e);
    }
}

// NUEVO: Funciones para cambiar clave
function mostrarModalCambiarClave() {
    document.getElementById("inputClaveActual").value = "";
    document.getElementById("inputClaveNueva").value = "";
    document.getElementById("inputClaveNuevaConf").value = "";
    document.getElementById("modalCambiarClave").classList.remove("hidden");
}

function cerrarModalCambiarClave() {
    document.getElementById("modalCambiarClave").classList.add("hidden");
}

async function ejecutarCambioClave() {
    const antigua = document.getElementById("inputClaveActual").value;
    const nueva = document.getElementById("inputClaveNueva").value;
    const nuevaConf = document.getElementById("inputClaveNuevaConf").value;

    if (!antigua || !nueva || !nuevaConf) {
        alert("Todos los campos son obligatorios.");
        return;
    }

    if (nueva !== nuevaConf) {
        alert("La nueva contraseña y su confirmación no coinciden.");
        return;
    }

    const formData = new FormData();
    formData.append("antigua_clave", antigua);
    formData.append("nueva_clave", nueva);

    try {
        const response = await fetch(`/auth/cambiar-clave?token=${SESSION_TOKEN}`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();

        if (response.ok) {
            alert("Contraseña cambiada exitosamente.");
            cerrarModalCambiarClave();
        } else {
            alert("Error: " + (data.detail || data.error || "No se pudo cambiar la contraseña."));
        }
    } catch (e) {
        alert("Error de red o del servidor.");
    }
}

// NUEVO: Función para eliminar partida (exclusivo Rol 4)
async function borrarPartida() {
    const partidaId = document.getElementById("admSelPartidaEdit").value;
    if (partidaId === "nueva") return;

    const p = AUX_DATA.partidas.find(x => x.id == partidaId);
    if (!p) return;

    if (!confirm(`¿Está seguro de que desea eliminar la partida "${p.descripcion}"? Esto eliminará de forma permanente todos los precios de Nuevos Proyectos y O&M asociados a ella.`)) {
        return;
    }

    try {
        const response = await fetch(`/admin/partidas/${partidaId}?token=${SESSION_TOKEN}`, {
            method: "DELETE"
        });
        const data = await response.json();

        if (response.ok) {
            alert("Partida eliminada exitosamente.");
            document.getElementById("admSelPartidaEdit").value = "nueva";
            cargarDatosPartidaParaEdicion();
            await precargarAuxiliares();
        } else {
            alert("Error: " + (data.detail || data.error || "No se pudo eliminar la partida."));
        }
    } catch (e) {
        alert("Error de red o del servidor.");
    }
}