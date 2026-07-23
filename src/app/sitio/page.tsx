import { Isotipo } from "./_lib/Isotipo";
import { BIENESTAR, C, CULTURA, mapsUrl } from "./_lib/data";
import { Nav } from "./_components/Nav";
import { Hero } from "./_components/Hero";
import { AliadosProvider } from "./_components/AliadosProvider";
import { Grid } from "./_components/Grid";
import { MuroLogos } from "./_components/MuroLogos";
import { EventForm } from "./_components/EventForm";
import { ScrollReveal } from "./_components/ScrollReveal";

const mapa = mapsUrl();

export default function SitioPage() {
  return (
    <AliadosProvider>
      <Nav />
      <Hero />

      <div className="franja">
        <i style={{ background: "var(--cacao)" }} />
        <i style={{ background: "var(--terracota)" }} />
        <i style={{ background: "var(--oliva)" }} />
        <i style={{ background: "var(--azul)" }} />
      </div>

      {/* ============ HISTORIA ============ */}
      <section className="sec" id="historia">
        <div className="wrap">
          <div className="eyebrow rv">La casa</div>
          <h2 className="rv">
            <span className="sc">Bienvenido al origen de todo</span>Historia
          </h2>
          <div className="hist">
            <div className="rv">
              <p className="intro">
                Construida en la década de 1950 por el presidente venezolano
                Marcos Pérez Jiménez, Quinta Mamá permaneció abandonada y
                saqueada durante más de veinte años. En 2023 comenzó un proceso
                integral de recuperación con el propósito de rescatar su
                arquitectura, preservar su valor histórico y devolverle la vida.
              </p>
              <p className="intro">
                Hoy, Quinta Mamá renace como un centro cultural y de bienestar
                que promueve el encuentro, el aprendizaje y la construcción de
                comunidad. Concebido como un proyecto intergeneracional y en
                constante evolución, continúa creciendo año tras año con la
                misión de generar un impacto positivo en la sociedad.
              </p>
            </div>
            <div className="linea rv">
              <div className="hito">
                <span className="a">1955</span>
                <span className="t">
                  Se construye la casa por el presidente venezolano Marcos Pérez
                  Jiménez. Arquitectura moderna venezolana en Chacao.
                </span>
              </div>
              <div className="hito">
                <span className="a">2000 — 2022</span>
                <span className="t">
                  Más de veinte años de abandono y saqueo.
                </span>
              </div>
              <div className="hito">
                <span className="a">2023</span>
                <span className="t">
                  Comienza la recuperación integral de la estructura y su valor
                  patrimonial.
                </span>
              </div>
              <div className="hito">
                <span className="a">Hoy</span>
                <span className="t">
                  Centro cultural autosustentable, impulsado por la comunidad
                  intergeneracional.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CULTURA ============ */}
      <section className="sec" id="cultura">
        <div className="wrap">
          <div className="eyebrow rv">Aliados</div>
          <h2 className="rv">
            <span className="sc">Donde el pasado inspira</span>Cultura
          </h2>
          <p className="intro rv">
            En Quinta Mamá conviven aliados que desarrollan propuestas
            culturales, creativas y de bienestar con una identidad propia.
            Invitamos a todos nuestros visitantes a conocer estos espacios,
            descubrir su trabajo y generar nuevas colaboraciones, proyectos y
            experiencias que fortalezcan nuestra comunidad.
          </p>
          <p className="intro rv">
            A continuación, podrás conocer cada una de las iniciativas que forman
            parte de Quinta Mamá.
          </p>
          <Grid id="gCultura" data={CULTURA} tono={C.terracota} />
        </div>
      </section>

      {/* ============ CITA ============ */}
      <section className="cita">
        <p className="rv">
          <span className="sc">Creamos un entorno donde el pasado</span>{" "}
          <em>inspira</em>{" "}
          <span className="sc">y el presente encuentra un lugar para</span>{" "}
          <em>pertenecer</em>
        </p>
      </section>

      {/* ============ BIENESTAR ============ */}
      <section className="sec" id="bienestar">
        <div className="wrap">
          <div className="eyebrow rv">Aliados</div>
          <h2 className="rv">
            <span className="sc">El cuerpo también recuerda</span>Bienestar
          </h2>
          <p className="intro rv">
            En Quinta Mamá reunimos profesionales y proyectos dedicados al
            bienestar integral. A través de experiencias enfocadas en la salud
            física, mental y emocional, nuestros espacios invitan a reconectar,
            aprender y cultivar hábitos que enriquecen la vida cotidiana.
          </p>
          <p className="intro rv">
            A continuación, podrás conocer cada una de las actividades de
            bienestar que forman parte de Quinta Mamá.
          </p>
          <Grid id="gBienestar" data={BIENESTAR} tono={C.oliva} />
        </div>
      </section>

      {/* ============ EVENTOS ============ */}
      <section className="sec" id="eventos">
        <div className="wrap">
          <div className="eyebrow rv">Espacios</div>
          <h2 className="rv">
            <span className="sc">Encuentra tu espacio perfecto</span>Eventos
          </h2>
          <p className="intro rv">
            Quinta Mamá ofrece espacios versátiles para la realización de eventos
            privados, corporativos, sociales, educativos, culturales y de
            bienestar. Cada ambiente puede adaptarse a diferentes formatos,
            brindando un entorno único para desarrollar experiencias memorables.
          </p>
          <p className="intro rv">
            Si estás interesado en realizar tu próximo evento en Quinta Mamá,
            contáctanos para conocer nuestros espacios y opciones de alquiler.
          </p>
          <EventForm />
        </div>
      </section>

      {/* ============ PDIS ============ */}
      <section className="sec" id="pdis">
        <div className="wrap">
          <div className="eyebrow rv">Programa de Impacto Social</div>
          <h2 className="rv">
            <span className="sc">El bienestar como tejido social</span>PDIS
          </h2>
          <p className="intro rv">
            En Quinta Mamá creemos que el bienestar es una herramienta para
            fortalecer el tejido social. A través de nuestro programa de Impacto
            Social, cocreamos espacios y experiencias que promueven la salud
            integral, el aprendizaje y la construcción de comunidad mediante
            alianzas estratégicas con profesionales y organizaciones
            comprometidas.
          </p>
          <p className="intro rv">
            Además de ofrecer actividades accesibles que brindan herramientas
            para el bienestar y el desarrollo personal, impulsamos iniciativas de
            recaudación de fondos con un modelo transparente, destinadas a
            generar oportunidades de reactivación económica y brindar apoyo
            directo a comunidades y personas en situación de vulnerabilidad.
          </p>
          <p className="intro rv">
            Para conocer más sobre nuestro programa de Impacto Social o explorar
            oportunidades de colaboración, contáctanos a través del siguiente
            enlace.
          </p>
          <div className="pdis-grid rv">
            <div className="pdis-item">
              <h3>Podcast</h3>
              <p>
                Nuestro podcast reúne a especialistas, profesores y emprendedores
                para compartir conversaciones sobre economía, finanzas, diseño,
                innovación y cultura, con el propósito de educar e inspirar al
                público venezolano.
              </p>
            </div>
            <div className="pdis-item">
              <h3>Actividades accesibles</h3>
              <p>
                Programación abierta de bienestar y formación, diseñada para que
                el acceso no dependa de la capacidad de pago.
              </p>
            </div>
            <div className="pdis-item">
              <h3>Recaudación transparente</h3>
              <p>
                Modelo de captación y rendición de fondos orientado a la
                reactivación económica y al apoyo directo de comunidades.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ALIANZAS ============ */}
      <section className="sec" id="aliados">
        <div className="wrap">
          <div className="eyebrow rv">Quiénes habitan la casa</div>
          <h2 className="rv">
            <span className="sc">Propuestas con identidad propia</span>Alianzas
          </h2>
          <p className="intro rv">
            Siete proyectos independientes reparten la casa entre sus tres pisos.
            Cada uno conserva su marca, su público y su forma de trabajar; juntos
            componen la programación de Quinta Mamá.
          </p>
          <MuroLogos />
        </div>
      </section>

      {/* ============ CIERRE / CONTACTO ============ */}
      <section className="cierre" id="contacto">
        <div
          className="rv"
          style={{
            width: "clamp(52px,7vw,74px)",
            margin: "0 auto 40px",
            color: "var(--terracota)",
            opacity: 0.9,
          }}
        >
          <Isotipo className="iso" />
        </div>
        <h2 className="rv">
          Donde elegimos <em>volver</em>
        </h2>
        <p className="rv">
          <a
            href={mapa}
            target="_blank"
            rel="noopener noreferrer"
            className="lnk-mapa"
          >
            Chacao · Caracas · Venezuela
          </a>
          <br />
          Martes a domingo
        </p>
        <div className="cta-fila rv">
          <a href={mapa} className="cta" target="_blank" rel="noopener noreferrer">
            Cómo llegar
          </a>
          <a href="#eventos" className="cta cta-alt">
            Reservar espacio
          </a>
        </div>
      </section>

      <footer>
        <span
          className="mono"
          style={{ fontSize: 26, letterSpacing: 0, textTransform: "none" }}
        >
          <span className="mq">Q</span>
          <span className="mm">M</span>
        </span>
        <span>Proyectos Quinta Mamá, C.A.</span>
        <span>En Quinta Mamá la cultura es la esencia del bienestar</span>
      </footer>

      <ScrollReveal />
    </AliadosProvider>
  );
}
